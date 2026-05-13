const getEl = (id) => document.getElementById(id);

let isBcvApi = true; 
let isBinanceApi = true; 

let binanceMemoryStack = JSON.parse(localStorage.getItem('vgap_binance_stack')) || ["613.54"];
let bcvMemoryStack = JSON.parse(localStorage.getItem('vgap_bcv_stack')) || ["421.87"];

let historicalChartInstance = null;
let currentChartType = 'paralelo'; 
let rawHistoryData = { oficial: [], paralelo: [] };

// --- UTILIDADES DE FORMATO ESTILO VENEZUELA ---
const formatVE = (num) => new Intl.NumberFormat('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(num);

// ESTA FUNCIÓN CONVIERTE "1.234,56" de vuelta al número matemático 1234.56 para que el sistema pueda multiplicar
const getRawNumber = (formattedString) => {
    if (!formattedString) return 0;
    const digits = String(formattedString).replace(/\D/g, ''); // Quita todo menos los números
    return digits ? parseInt(digits, 10) / 100 : 0; // Divide entre 100 para crear los decimales automáticamente
};

window.startApp = (theme) => {
    document.body.setAttribute('data-theme', theme);
    getEl('themeToggleCheckbox').checked = theme === 'dark';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#000000' : '#F2F2F7');
    localStorage.setItem('vgap_theme_saved', theme);
    getEl('welcomeScreen').classList.add('hidden');
    getEl('mainApp').style.opacity = '1';
};

window.toggleThemeSwitch = () => {
    const isDark = getEl('themeToggleCheckbox').checked;
    const theme = isDark ? 'dark' : 'light';
    document.body.setAttribute('data-theme', theme);
    document.querySelector('meta[name="theme-color"]').setAttribute('content', isDark ? '#000000' : '#F2F2F7');
    localStorage.setItem('vgap_theme_saved', theme);
    if(historicalChartInstance) renderChartJs(); 
};

// --- LÓGICA BCV ---
window.toggleBcv = async () => {
    isBcvApi = !isBcvApi;
    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');
    const container = getEl('bcvContainer');
    
    if (isBcvApi) {
        badge.innerText = "...";
        badge.className = "mode-badge api-bcv";
        input.disabled = true;
        container.classList.remove('unlocked');
        await fetchBcvOnly();
    } else {
        badge.innerText = "MANUAL";
        badge.className = "mode-badge manual-mode";
        input.disabled = false;
        
        let lastRaw = bcvMemoryStack.length > 1 ? bcvMemoryStack[bcvMemoryStack.length - 2] : bcvMemoryStack[bcvMemoryStack.length - 1];
        input.value = formatVE(parseFloat(lastRaw));
        
        sync('ratebcv');
        container.classList.add('unlocked');
        input.focus();
    }
};

// --- LÓGICA BINANCE ---
window.toggleBinance = async () => {
    isBinanceApi = !isBinanceApi;
    const badge = getEl('badgeBinance');
    const input = getEl('rateBinance');
    
    if (isBinanceApi) {
        badge.innerText = "...";
        badge.className = "mode-badge api-binance";
        input.disabled = true;
        await fetchBinanceOnly(); 
    } else {
        badge.innerText = "MANUAL";
        badge.className = "mode-badge manual-mode";
        input.disabled = false;
        
        let lastRaw = binanceMemoryStack.length > 1 ? binanceMemoryStack[binanceMemoryStack.length - 2] : binanceMemoryStack[binanceMemoryStack.length - 1];
        input.value = formatVE(parseFloat(lastRaw));
        
        sync('ratebinance');
        input.focus();
    }
};

window.fetchBcvOnly = async () => {
    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');
    try {
        const r = await fetch('https://ve.dolarapi.com/v1/historicos/dolares?t=' + Date.now());
        const data = await r.json();
        const bcvHist = data.filter(d => d.fuente === 'oficial').sort((a,b) => new Date(a.fecha) - new Date(b.fecha));

        if (bcvHist.length > 0) {
            const val = parseFloat(bcvHist[bcvHist.length - 1].promedio);
            input.value = formatVE(val); // Aplicamos el formato al traer la API
            
            if(val.toFixed(2) !== bcvMemoryStack[bcvMemoryStack.length-1]) {
                bcvMemoryStack.push(val.toFixed(2));
                if(bcvMemoryStack.length > 10) bcvMemoryStack.shift();
                localStorage.setItem('vgap_bcv_stack', JSON.stringify(bcvMemoryStack));
            }

            rawHistoryData.oficial = bcvHist.slice(-15);
            getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', {timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true}).format(new Date())} VEN`;
            badge.innerText = "AUTO";
            sync('ratebcv');
        }
    } catch (e) { badge.innerText = "ERROR"; setTimeout(() => window.toggleBcv(), 1000); }
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
            input.value = formatVE(val); // Aplicamos el formato al traer la API
            
            if(val.toFixed(2) !== binanceMemoryStack[binanceMemoryStack.length-1]) {
                binanceMemoryStack.push(val.toFixed(2));
                if(binanceMemoryStack.length > 10) binanceMemoryStack.shift();
                localStorage.setItem('vgap_binance_stack', JSON.stringify(binanceMemoryStack));
            }
            
            badge.innerText = "AUTO";
            sync('ratebinance');
        }
    } catch (e) { badge.innerText = "ERROR"; setTimeout(() => window.toggleBinance(), 1000); }
};

// --- GRÁFICOS ---
window.openChartModal = async () => {
    getEl('chartModal').classList.remove('hidden');
    if(rawHistoryData.paralelo.length === 0) {
        try {
            const r = await fetch('https://ve.dolarapi.com/v1/historicos/dolares?t=' + Date.now());
            const data = await r.json();
            rawHistoryData.paralelo = data.filter(d => d.fuente === 'paralelo').sort((a,b) => new Date(a.fecha) - new Date(b.fecha)).slice(-15);
            if(rawHistoryData.oficial.length === 0) {
                rawHistoryData.oficial = data.filter(d => d.fuente === 'oficial').sort((a,b) => new Date(a.fecha) - new Date(b.fecha)).slice(-15);
            }
        } catch(e) {}
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
    const currentDataList = rawHistoryData[currentChartType];
    if(!currentDataList || currentDataList.length === 0) return;
    const labels = currentDataList.map(d => new Date(d.fecha + "T12:00:00").toLocaleDateString('es-VE', {day: '2-digit', month: 'short'}));
    const prices = currentDataList.map(d => parseFloat(d.promedio));
    const isPar = currentChartType === 'paralelo';
    const color = isPar ? '#FF9F0A' : '#0A84FF';
    if(historicalChartInstance) historicalChartInstance.destroy();
    historicalChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                data: prices,
                borderColor: color,
                backgroundColor: isPar ? 'rgba(255, 159, 10, 0.15)' : 'rgba(10, 132, 255, 0.15)',
                borderWidth: 3,
                fill: true,
                pointRadius: 4,
                tension: 0.3 
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { 
                legend: {display: false}, 
                tooltip: { 
                    mode: 'index', 
                    intersect: false,
                    callbacks: {
                        label: function(context) { 
                            return 'Bs.S ' + formatVE(context.parsed.y); 
                        }
                    }
                } 
            },
            scales: {
                x: { ticks: {color: isDark ? '#8E8E93' : '#636366'} },
                y: { grid: {color: isDark ? '#333335' : '#D1D1D6', borderDash: [5,5]}, ticks: {color: isDark ? '#8E8E93' : '#636366'} }
            }
        }
    });
}

// --- ARRANQUE Y SISTEMA DE "AUTO-TECLEO ESTILO BANCO" ---
window.onload = () => {
    const savedTheme = localStorage.getItem('vgap_theme_saved');
    if (savedTheme) {
        getEl('welcomeScreen').style.display = 'none';
        document.body.setAttribute('data-theme', savedTheme);
        getEl('themeToggleCheckbox').checked = savedTheme === 'dark';
        getEl('mainApp').style.opacity = '1';
    }
    fetchBcvOnly();
    fetchBinanceOnly(); 

    // Aquí sucede la magia de la máscara de Banco de Venezuela
    ['inputUsd', 'inputUsdt', 'inputBs', 'rateBcv', 'rateBinance'].forEach(id => {
        const el = getEl(id);
        el.addEventListener('input', (e) => {
            if (e.target.value === "") {
                sync(id.replace('input', '').toLowerCase());
                return;
            }
            // Extrae los números y le pone la máscara automática
            const rawMath = getRawNumber(e.target.value);
            e.target.value = formatVE(rawMath);
            
            sync(id.replace('input', '').toLowerCase());
        });
    });
};

const sync = (origin) => {
    // Al hacer cálculos, necesitamos extraer los números "limpios" de la máscara que ve el usuario
    const bcv = getRawNumber(getEl('rateBcv').value) || 1;
    const p2p = getRawNumber(getEl('rateBinance').value) || 1;
    const com = 0.06;
    const usd = getEl('inputUsd'), usdt = getEl('inputUsdt'), bs = getEl('inputBs');
    
    if (origin === 'usd' || origin === 'ratebcv') {
        const v = getRawNumber(usd.value);
        if(usd.value === "") { bs.value = ""; usdt.value = ""; } 
        else {
            bs.value = formatVE(v * bcv);
            usdt.value = formatVE((v * bcv / p2p) + com);
        }
    } else if (origin === 'usdt') {
        const v = getRawNumber(usdt.value);
        if(usdt.value === "") { bs.value = ""; usd.value = ""; } 
        else {
            const neto = v > com ? v - com : 0;
            bs.value = neto > 0 ? formatVE(neto * p2p) : "";
            usd.value = neto > 0 ? formatVE(neto * p2p / bcv) : "";
        }
    } else if (origin === 'bs' || origin === 'ratebinance') {
        const v = getRawNumber(bs.value);
        if(bs.value === "") { usd.value = ""; usdt.value = ""; } 
        else {
            usd.value = v > 0 ? formatVE(v / bcv) : "";
            usdt.value = v > 0 ? formatVE((v / p2p) + com) : "";
        }
    }
    updateUI();
};

const updateUI = () => {
    const bcv = getRawNumber(getEl('rateBcv').value) || 1;
    const p2p = getRawNumber(getEl('rateBinance').value) || 1;
    const bs = getRawNumber(getEl('inputBs').value) || 0;
    const usdtRaw = getRawNumber(getEl('inputUsdt').value) || 0;
    
    getEl('bigBsDisplay').innerText = "Bs.S " + formatVE(bs);
    
    const power = bs > 0 ? (bs / bcv) : 0;
    getEl('powerUsd').innerText = formatVE(power);
    getEl('brechaBadge').innerText = formatVE(((p2p - bcv)/bcv)*100) + "%";
    getEl('factorBadge').innerText = formatVE(p2p/bcv) + "x";

    const usdtNeto = usdtRaw > 0.06 ? usdtRaw - 0.06 : 0;
    const profitArea = getEl('profitArea');
    const extraEl = getEl('extraProfit');
    
    if (bs > 0 && usdtNeto > 0 && power > usdtNeto) {
        const extra = power - usdtNeto;
        if(extraEl && profitArea) {
            extraEl.innerText = "+$" + formatVE(extra);
            profitArea.style.display = 'inline-block';
        }
    } else {
        if(profitArea) profitArea.style.display = 'none';
    }
};

window.copyToClipboard = async () => {
    const txt = getEl('bigBsDisplay').innerText.replace('Bs.S ', '');
    await navigator.clipboard.writeText(txt);
    const btn = document.querySelector('.btn-copy-elegant');
    btn.innerText = "¡COPIADO!";
    setTimeout(() => btn.innerText = "COPIAR MONTO", 1000);
};

window.copyInputBs = async () => {
    const val = getEl('inputBs').value;
    if(val) await navigator.clipboard.writeText(val);
};

window.resetAll = () => { ['inputUsd', 'inputUsdt', 'inputBs'].forEach(id => getEl(id).value = ""); updateUI(); };
