// V-Gap Ultra — Refactored & Enhanced
const getEl = (id) => document.getElementById(id);

// ─── ESTADO ───────────────────────────────────────────────
let isBcvApi     = true;
let isBinanceApi = true;
let alertActive  = false;
let refreshTimer = null;
let refreshSecondsLeft = 0;

const REFRESH_INTERVAL = 5 * 60; // segundos entre auto-refresh

let binanceMemoryStack = JSON.parse(localStorage.getItem('vgap_binance_stack')) || ["613.54"];
let bcvMemoryStack     = JSON.parse(localStorage.getItem('vgap_bcv_stack'))     || ["421.87"];
let conversionHistory  = JSON.parse(localStorage.getItem('vgap_history'))       || [];

let historicalChartInstance = null;
let currentChartType = 'paralelo';
let rawHistoryData   = { oficial: [], paralelo: [] };

// ─── COMISIÓN (centralizada) ───────────────────────────────
const getCommission = () => getRawNumber(getEl('commissionInput').value) || 0;

// ─── FORMATO VENEZOLANO ────────────────────────────────────
const formatVE = (num) =>
    new Intl.NumberFormat('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(num);

// Convierte "1.234,56" → 1234.56  |  "1.234" → 1234.00
const getRawNumber = (str) => {
    if (!str) return 0;
    const s = String(str).trim();
    // Si tiene coma: la coma es separador decimal venezolano
    if (s.includes(',')) {
        const normalized = s.replace(/\./g, '').replace(',', '.');
        return parseFloat(normalized) || 0;
    }
    // Sin coma: solo entero (o punto decimal inglés)
    return parseFloat(s.replace(/\./g, '')) || 0;
};

// ─── ARRANQUE ─────────────────────────────────────────────
window.startApp = (theme) => {
    applyTheme(theme);
    localStorage.setItem('vgap_theme_saved', theme);
    getEl('welcomeScreen').classList.add('hidden');
    getEl('mainApp').style.opacity = '1';
};

window.onload = () => {
    const savedTheme = localStorage.getItem('vgap_theme_saved');
    if (savedTheme) {
        getEl('welcomeScreen').style.display = 'none';
        applyTheme(savedTheme);
        getEl('mainApp').style.opacity = '1';
    }

    // Alert threshold guardado
    const savedAlert = localStorage.getItem('vgap_alert_threshold');
    if (savedAlert) getEl('alertThreshold').value = savedAlert;

    fetchAll();
    startAutoRefresh();
    bindInputs();
};

function applyTheme(theme) {
    document.body.setAttribute('data-theme', theme);
    getEl('themeToggleCheckbox').checked = theme === 'dark';
    document.querySelector('meta[name="theme-color"]')
        .setAttribute('content', theme === 'dark' ? '#000000' : '#F2F2F7');
    if (historicalChartInstance) renderChartJs();
}

window.toggleThemeSwitch = () => {
    const theme = getEl('themeToggleCheckbox').checked ? 'dark' : 'light';
    applyTheme(theme);
    localStorage.setItem('vgap_theme_saved', theme);
};

// ─── AUTO REFRESH ─────────────────────────────────────────
function startAutoRefresh() {
    clearInterval(refreshTimer);
    refreshSecondsLeft = REFRESH_INTERVAL;
    refreshTimer = setInterval(() => {
        refreshSecondsLeft--;
        updateCountdown();
        if (refreshSecondsLeft <= 0) {
            fetchAll();
            refreshSecondsLeft = REFRESH_INTERVAL;
        }
    }, 1000);
}

function updateCountdown() {
    const el = getEl('refreshCountdown');
    if (!el) return;
    const m = Math.floor(refreshSecondsLeft / 60);
    const s = refreshSecondsLeft % 60;
    el.innerText = `Actualiza en ${m}:${String(s).padStart(2,'0')}`;
}

async function fetchAll() {
    await Promise.all([fetchBcvOnly(), fetchBinanceOnly()]);
}

// ─── BCV ──────────────────────────────────────────────────
window.toggleBcv = async () => {
    isBcvApi = !isBcvApi;
    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');
    const container = getEl('bcvContainer');

    if (isBcvApi) {
        badge.innerText = '...';
        badge.className = 'mode-badge api-bcv';
        input.disabled = true;
        container.classList.remove('unlocked');
        await fetchBcvOnly();
    } else {
        badge.innerText = 'MANUAL';
        badge.className = 'mode-badge manual-mode';
        input.disabled = false;
        container.classList.add('unlocked');
        const last = bcvMemoryStack[bcvMemoryStack.length - 1];
        input.value = formatVE(parseFloat(last));
        sync('ratebcv');
        input.focus();
    }
};

window.fetchBcvOnly = async () => {
    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');
    try {
        // Endpoint ligero: solo valor actual (no histórico)
        const r = await fetch('https://ve.dolarapi.com/v1/dolares/oficial?t=' + Date.now());
        const data = await r.json();
        if (data && data.promedio) {
            const val = parseFloat(data.promedio);
            input.value = formatVE(val);
            pushToStack(bcvMemoryStack, val.toFixed(2), 'vgap_bcv_stack');
            badge.innerText = 'AUTO';
            badge.className = 'mode-badge api-bcv';
            getEl('lastUpdate').innerText = `Actualizado: ${formatTime()} VEN`;
            sync('ratebcv');
        }
    } catch (e) {
        badge.innerText = 'ERROR';
        badge.className = 'mode-badge error-mode';
        // NO hace retry automático para evitar loop infinito
    }
};

// ─── BINANCE ──────────────────────────────────────────────
window.toggleBinance = async () => {
    isBinanceApi = !isBinanceApi;
    const badge = getEl('badgeBinance');
    const input = getEl('rateBinance');

    if (isBinanceApi) {
        badge.innerText = '...';
        badge.className = 'mode-badge api-binance';
        input.disabled = true;
        await fetchBinanceOnly();
    } else {
        badge.innerText = 'MANUAL';
        badge.className = 'mode-badge manual-mode';
        input.disabled = false;
        const last = binanceMemoryStack[binanceMemoryStack.length - 1];
        input.value = formatVE(parseFloat(last));
        sync('ratebinance');
        input.focus();
    }
};

window.fetchBinanceOnly = async () => {
    const badge = getEl('badgeBinance');
    const input = getEl('rateBinance');
    try {
        const r = await fetch('https://ve.dolarapi.com/v1/dolares?t=' + Date.now());
        const data = await r.json();
        const binData = data.find(item => item.fuente === 'paralelo');
        if (binData && binData.promedio) {
            const val = parseFloat(binData.promedio);
            input.value = formatVE(val);
            pushToStack(binanceMemoryStack, val.toFixed(2), 'vgap_binance_stack');
            badge.innerText = 'AUTO';
            badge.className = 'mode-badge api-binance';
            sync('ratebinance');
            checkAlert();
        }
    } catch (e) {
        badge.innerText = 'ERROR';
        badge.className = 'mode-badge error-mode';
    }
};

// ─── HELPER: STACK ────────────────────────────────────────
function pushToStack(stack, val, key) {
    if (val !== stack[stack.length - 1]) {
        stack.push(val);
        if (stack.length > 15) stack.shift();
        localStorage.setItem(key, JSON.stringify(stack));
    }
}

// ─── INPUTS ───────────────────────────────────────────────
function bindInputs() {
    ['inputUsd', 'inputUsdt', 'inputBs', 'rateBcv', 'rateBinance'].forEach(id => {
        getEl(id).addEventListener('input', (e) => {
            const raw = getRawNumber(e.target.value);
            if (e.target.value !== '' && raw !== 0) {
                e.target.value = formatVE(raw);
            }
            sync(id.replace('input', '').toLowerCase());
        });
    });

    getEl('commissionInput').addEventListener('input', (e) => {
        const raw = getRawNumber(e.target.value);
        if (e.target.value !== '' && raw !== 0) e.target.value = formatVE(raw);
        sync('usdt'); // recalcular
    });
}

// ─── SYNC (motor de cálculo) ──────────────────────────────
const sync = (origin) => {
    const bcv  = getRawNumber(getEl('rateBcv').value)     || 1;
    const p2p  = getRawNumber(getEl('rateBinance').value)  || 1;
    const com  = getCommission();

    const usd  = getEl('inputUsd');
    const usdt = getEl('inputUsdt');
    const bs   = getEl('inputBs');

    if (origin === 'usd' || origin === 'ratebcv') {
        const v = getRawNumber(usd.value);
        if (!usd.value) { bs.value = ''; usdt.value = ''; }
        else {
            bs.value   = formatVE(v * bcv);
            usdt.value = formatVE((v * bcv / p2p) + com);
        }
    } else if (origin === 'usdt') {
        const v = getRawNumber(usdt.value);
        if (!usdt.value) { bs.value = ''; usd.value = ''; }
        else {
            const neto = v > com ? v - com : 0;
            bs.value  = neto > 0 ? formatVE(neto * p2p)       : '';
            usd.value = neto > 0 ? formatVE(neto * p2p / bcv)  : '';
        }
    } else if (origin === 'bs' || origin === 'ratebinance') {
        const v = getRawNumber(bs.value);
        if (!bs.value) { usd.value = ''; usdt.value = ''; }
        else {
            usd.value  = v > 0 ? formatVE(v / bcv)         : '';
            usdt.value = v > 0 ? formatVE((v / p2p) + com)  : '';
        }
    }

    updateUI();
};

// ─── UI ───────────────────────────────────────────────────
const updateUI = () => {
    const bcv      = getRawNumber(getEl('rateBcv').value)     || 1;
    const p2p      = getRawNumber(getEl('rateBinance').value)  || 1;
    const bsVal    = getRawNumber(getEl('inputBs').value)      || 0;
    const usdtRaw  = getRawNumber(getEl('inputUsdt').value)    || 0;
    const com      = getCommission();

    getEl('bigBsDisplay').innerText = 'Bs.S ' + formatVE(bsVal);

    const power = bsVal > 0 ? bsVal / bcv : 0;
    getEl('powerUsd').innerText = formatVE(power);

    const brecha = ((p2p - bcv) / bcv) * 100;
    getEl('brechaBadge').innerText = formatVE(brecha) + '%';
    getEl('factorBadge').innerText = formatVE(p2p / bcv) + 'x';

    // Badge color según brecha
    const badge = getEl('brechaBadge');
    badge.className = 'gap-badge ' + (brecha > 30 ? 'gap-high' : brecha > 15 ? 'gap-mid' : 'gap-low');

    // Ganancia
    const usdtNeto    = usdtRaw > com ? usdtRaw - com : 0;
    const profitArea  = getEl('profitArea');
    if (bsVal > 0 && usdtNeto > 0 && power > usdtNeto) {
        const extra = power - usdtNeto;
        getEl('extraProfit').innerText = '+$' + formatVE(extra);
        profitArea.style.display = 'inline-block';
    } else {
        profitArea.style.display = 'none';
    }
};

// ─── ALERTA DE BRECHA ─────────────────────────────────────
window.toggleAlert = () => {
    alertActive = !alertActive;
    const btn = getEl('alertToggle');
    btn.innerText = alertActive ? 'ON' : 'OFF';
    btn.className = 'alert-toggle-btn ' + (alertActive ? 'alert-on' : '');
    if (alertActive) {
        const t = getEl('alertThreshold').value;
        localStorage.setItem('vgap_alert_threshold', t);
        checkAlert();
    } else {
        getEl('alertBanner').classList.add('hidden');
    }
};

function checkAlert() {
    if (!alertActive) return;
    const bcv    = getRawNumber(getEl('rateBcv').value)    || 1;
    const p2p    = getRawNumber(getEl('rateBinance').value) || 1;
    const brecha = ((p2p - bcv) / bcv) * 100;
    const threshold = parseFloat(getEl('alertThreshold').value) || 0;
    const banner = getEl('alertBanner');
    if (threshold > 0 && brecha >= threshold) {
        banner.innerText = `⚠️ ¡Brecha actual ${formatVE(brecha)}% supera tu límite de ${threshold}%!`;
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

// ─── HISTORIAL DE CONVERSIONES ────────────────────────────
function saveConversion() {
    const bs   = getEl('inputBs').value;
    const usd  = getEl('inputUsd').value;
    const usdt = getEl('inputUsdt').value;
    if (!bs || getRawNumber(bs) === 0) return;

    const entry = {
        bs, usd, usdt,
        bcv:     getEl('rateBcv').value,
        binance: getEl('rateBinance').value,
        time:    formatTime()
    };
    conversionHistory.unshift(entry);
    if (conversionHistory.length > 10) conversionHistory.pop();
    localStorage.setItem('vgap_history', JSON.stringify(conversionHistory));
}

window.openHistoryModal = () => {
    const list = getEl('historyList');
    if (conversionHistory.length === 0) {
        list.innerHTML = '<p class="history-empty">Sin conversiones guardadas aún.<br>Copia un monto para guardar.</p>';
    } else {
        list.innerHTML = conversionHistory.map(e => `
            <div class="history-item">
                <div class="history-main">Bs.S <strong>${e.bs}</strong></div>
                <div class="history-sub">${e.usd} USD · ${e.usdt} USDT</div>
                <div class="history-sub">BCV ${e.bcv} · BIN ${e.binance}</div>
                <div class="history-time">${e.time}</div>
            </div>`).join('');
    }
    getEl('historyModal').classList.remove('hidden');
};

window.closeHistoryModal = () => getEl('historyModal').classList.add('hidden');

window.clearHistory = () => {
    conversionHistory = [];
    localStorage.removeItem('vgap_history');
    closeHistoryModal();
};

// ─── COPIAR / COMPARTIR ───────────────────────────────────
window.copyToClipboard = async () => {
    const txt = getEl('bigBsDisplay').innerText.replace('Bs.S ', '');
    await navigator.clipboard.writeText(txt);
    const btn = getEl('copyBtnText');
    btn.innerText = '¡COPIADO!';
    setTimeout(() => btn.innerText = 'COPIAR MONTO', 1500);
    saveConversion();
};

window.copyInputBs = async () => {
    const val = getEl('inputBs').value;
    if (val) {
        await navigator.clipboard.writeText(val);
        saveConversion();
    }
};

window.shareResult = async () => {
    const bs   = getEl('bigBsDisplay').innerText;
    const usd  = getEl('inputUsd').value;
    const usdt = getEl('inputUsdt').value;
    const bcv  = getEl('rateBcv').value;
    const bin  = getEl('rateBinance').value;

    const text = `💱 V-Gap Ultra\n${bs}\n💵 ${usd} USD (BCV ${bcv})\n🟡 ${usdt} USDT (Binance ${bin})`;

    if (navigator.share) {
        navigator.share({ text });
    } else {
        await navigator.clipboard.writeText(text);
        alert('Resultado copiado al portapapeles.');
    }
};

window.resetAll = () => {
    ['inputUsd', 'inputUsdt', 'inputBs'].forEach(id => getEl(id).value = '');
    updateUI();
};

// ─── GRÁFICO ──────────────────────────────────────────────
window.openChartModal = async () => {
    getEl('chartModal').classList.remove('hidden');
    if (rawHistoryData.paralelo.length === 0) {
        try {
            const r = await fetch('https://ve.dolarapi.com/v1/historicos/dolares?t=' + Date.now());
            const data = await r.json();
            rawHistoryData.paralelo = data.filter(d => d.fuente === 'paralelo')
                .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(-15);
            rawHistoryData.oficial = data.filter(d => d.fuente === 'oficial')
                .sort((a, b) => new Date(a.fecha) - new Date(b.fecha)).slice(-15);
        } catch (e) {}
    }
    renderChartJs();
};

window.closeChartModal = () => getEl('chartModal').classList.add('hidden');

window.switchChartType = (type) => {
    currentChartType = type;
    getEl('tabChartParalelo').classList.toggle('active', type === 'paralelo');
    getEl('tabChartBcv').classList.toggle('active', type === 'oficial');
    renderChartJs();
};

function renderChartJs() {
    const ctx = getEl('historyChart').getContext('2d');
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    const list = rawHistoryData[currentChartType];
    if (!list || list.length === 0) return;

    const labels = list.map(d =>
        new Date(d.fecha + 'T12:00:00').toLocaleDateString('es-VE', { day: '2-digit', month: 'short' }));
    const prices = list.map(d => parseFloat(d.promedio));
    const isPar  = currentChartType === 'paralelo';
    const color  = isPar ? '#FF9F0A' : '#0A84FF';

    if (historicalChartInstance) historicalChartInstance.destroy();
    historicalChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                data: prices,
                borderColor: color,
                backgroundColor: isPar ? 'rgba(255,159,10,0.15)' : 'rgba(10,132,255,0.15)',
                borderWidth: 3,
                fill: true,
                pointRadius: 4,
                tension: 0.3
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index', intersect: false,
                    callbacks: { label: (ctx) => 'Bs.S ' + formatVE(ctx.parsed.y) }
                }
            },
            scales: {
                x: { ticks: { color: isDark ? '#8E8E93' : '#636366' } },
                y: {
                    grid: { color: isDark ? '#333335' : '#D1D1D6', borderDash: [5, 5] },
                    ticks: { color: isDark ? '#8E8E93' : '#636366' }
                }
            }
        }
    });
}

// ─── UTIL ─────────────────────────────────────────────────
function formatTime() {
    return new Intl.DateTimeFormat('es-VE', {
        timeZone: 'America/Caracas',
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: true
    }).format(new Date());
}
