const getEl = (id) => document.getElementById(id);

// --- CONFIGURACIÓN GLOBAL ---
const CACHE_MINUTES = 15; // Tiempo de espera antes de volver a llamar a la API
const USDT_FEE = 0.06;    // Comisión de Binance

let isBcvApi = true; 
let isBinanceApi = true; 

let binanceMemoryStack = JSON.parse(localStorage.getItem('vgap_binance_stack')) || ["613.54"];
let bcvMemoryStack = JSON.parse(localStorage.getItem('vgap_bcv_stack')) || ["421.87"];

let historicalChartInstance = null;
let currentChartType = 'paralelo'; 
let rawHistoryData = { oficial: [], paralelo: [] };

// --- UTILIDADES DE FORMATO ESTILO VENEZUELA ---
const formatVE = (num) => new Intl.NumberFormat('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(num);

const getRawNumber = (formattedString) => {
    if (!formattedString) return 0;
    const digits = String(formattedString).replace(/\D/g, ''); 
    return digits ? parseInt(digits, 10) / 100 : 0; 
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
        let data;
        const cachedData = localStorage.getItem('vgap_bcv_data');
        const cachedTime = localStorage.getItem('vgap_bcv_time');
        const now = Date.now();
        
        // Caché salvavidas de 15 minutos
        if (cachedData && cachedTime && (now - parseInt(cachedTime) < CACHE_MINUTES * 60 * 1000)) {
            data = JSON.parse(cachedData);
        } else {
            // PROBANDO: API gratuita de Rafnixg (https://bcv-api.rafnixg.dev)
            const r = await fetch('https://bcv-api.rafnixg.dev/rates/');
            if (!r.ok) throw new Error('Fallo al conectar con la API de rafnixg');
            data = await r.json();
            
            localStorage.setItem('vgap_bcv_data', JSON.stringify(data));
            localStorage.setItem('vgap_bcv_time', now.toString());
        }

        // Búsqueda inteligente del valor USD en el JSON
        let tasaDolar = null;
        if (data && data.rates && data.rates.USD) {
            tasaDolar = data.rates.USD.value || data.rates.USD;
        } else if (data && data.USD) {
            tasaDolar = data.USD.value || data.USD;
        } else if (Array.isArray(data)) {
            const usdObj = data.find(item => item.currency === 'USD' || item.name === 'USD');
            if (usdObj) tasaDolar = usdObj.value || usdObj.exchange;
        }

        if (tasaDolar) {
            const val = parseFloat(tasaDolar);
            input.value = formatVE(val); // Formato de moneda
            
            if(val.toFixed(2) !== bcvMemoryStack[bcvMemoryStack.length-1]) {
                bcvMemoryStack.push(val.toFixed(2));
                if(bcvMemoryStack.length > 10) bcvMemoryStack.shift();
                localStorage.setItem('vgap_bcv_stack', JSON.stringify(bcvMemoryStack));
            }

            getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', {
                timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', 
                hour: '2-digit', minute: '2-digit', hour12: true
            }).format(new Date())} VEN`;
            
            badge.innerText = "AUTO";
            sync('ratebcv');
        } else {
            console.log("JSON recibido:", data);
            throw new Error('Estructura de datos no reconocida');
        }
    } catch (e) { 
        console.error("Error cargando BCV:", e);
        badge.innerText = "ERROR"; 
        setTimeout(() => window.toggleBcv(), 1000); 
    }
};

window.fetchBinanceOnly = async () => {
    const badge = getEl('badgeBinance');
    const input = getEl('rateBinance');
    try {
        let data;
        const cachedData = localStorage.getItem('vgap_binance_data');
        const cachedTime = localStorage.getItem('vgap_binance_time');
        const now = Date.now();
        
        if (cachedData && cachedTime && (now - parseInt(cachedTime) < CACHE_MINUTES * 60 * 1000)) {
            data = JSON.parse(cachedData);
        } else {
            const r = await fetch('https://ve.dolarapi.com/v1/dolares');
            data = await r.json();
            localStorage.setItem('vgap_binance_data', JSON.stringify(data));
            localStorage.setItem('vgap_binance_time', now.toString());
        }

        const binData = data.find(item => item.fuente === 'paralelo');
        if (binData && binData.promedio) {
            const val = parseFloat(binData.promedio);
            input.value = formatVE(val); 
            
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
            const r = await fetch('https://ve.dolarapi.com/v1/historicos/dolares');
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

    ['inputUsd', 'inputUsdt', 'inputBs', 'rateBcv', 'rateBinance'].forEach(id => {
        const el = getEl(id);
        el.addEventListener('input', (e) => {
            if (e.target.value === "") {
                sync(id.replace('input', '').toLowerCase());
                return;
            }
            const rawMath = getRawNumber(e.target.value);
            e.target.value = formatVE(rawMath);
            
            sync(id.replace('input', '').toLowerCase());
        });
    });
};

const sync = (origin) => {
    const bcv = getRawNumber(getEl('rateBcv').value) || 1;
    const p2p = getRawNumber(getEl('rateBinance').value) || 1;
    const com = USDT_FEE;
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

    const usdtNeto = usdtRaw > USDT_FEE ? usdtRaw - USDT_FEE : 0;
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
