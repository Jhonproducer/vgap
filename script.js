const getEl = (id) => document.getElementById(id);

// --- CONFIGURACIÓN GLOBAL ---
const CACHE_MINUTES = 15; // Tiempo de espera antes de volver a llamar a la API
const USDT_FEE = 0.06;    // Comisión de Binance

let isBcvApi = true; 
let isBinanceApi = true; 

// Variables para cálculos matemáticos exactos (Sin redondear)
window.exactBcvRate = 0;
window.exactBinanceRate = 0;

let binanceMemoryStack = JSON.parse(localStorage.getItem('vgap_binance_stack')) || ["613.54"];
let bcvMemoryStack = JSON.parse(localStorage.getItem('vgap_bcv_stack')) || ["421.87"];

let historicalChartInstance = null;
let currentChartType = 'paralelo'; 
let rawHistoryData = { oficial: [], paralelo: [] };

// --- UTILIDADES DE FORMATO ESTILO VENEZUELA ---
// Redondeo comercial preciso (si el 3er decimal es >=5, sube), evitando el bug
// clásico de coma flotante (ej: 1.005 -> 1.00 en vez de 1.01). Se añade un
// épsilon minúsculo (muy por debajo de cualquier centavo real) para corregir
// el error de representación binaria antes de redondear.
const roundVE = (num) => {
    if (!isFinite(num)) return 0;
    const sign = num < 0 ? -1 : 1;
    const abs = Math.abs(num);
    return sign * Math.round((abs + 1e-9) * 100) / 100;
};

const formatVE = (num) => new Intl.NumberFormat('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(roundVE(num));

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

// Núcleo común de "pedir tasa, cachear, guardar en el stack y refrescar UI"
// usado por BCV y Binance. Cada uno solo aporta su URL, sus llaves de caché
// y cómo extraer el valor/fecha de su respuesta particular.
async function _fetchRateCore({ cacheDataKey, cacheTimeKey, url, extract, badge, input, syncOrigin, memoryStack, memoryStackKey, onDate }) {
    let data;
    const cachedData = localStorage.getItem(cacheDataKey);
    const cachedTime = localStorage.getItem(cacheTimeKey);
    const now = Date.now();

    if (cachedData && cachedTime && (now - parseInt(cachedTime) < CACHE_MINUTES * 60 * 1000)) {
        data = JSON.parse(cachedData);
    } else {
        const r = await fetch(url);
        if (!r.ok) throw new Error('Fallo la conexión: ' + url);
        data = await r.json();
        localStorage.setItem(cacheDataKey, JSON.stringify(data));
        localStorage.setItem(cacheTimeKey, now.toString());
    }

    const { value, date } = extract(data);
    if (!value) throw new Error('Estructura de datos no reconocida');

    const val = parseFloat(value);

    // Redondeo comercial preciso antes de comparar/guardar (ver roundVE arriba)
    const rounded = roundVE(val).toFixed(2);
    if (rounded !== memoryStack[memoryStack.length - 1]) {
        memoryStack.push(rounded);
        if (memoryStack.length > 10) memoryStack.shift();
        localStorage.setItem(memoryStackKey, JSON.stringify(memoryStack));
    }

    return { val, date };
}

window.fetchBcvOnly = async () => {
    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');
    try {
        const { val, date } = await _fetchRateCore({
            cacheDataKey: 'vgap_bcv_data',
            cacheTimeKey: 'vgap_bcv_time',
            url: 'https://rates.dolarvzla.com/bcv/current.json',
            extract: (data) => ({
                value: data?.current?.usd ?? null,
                date: data?.current?.date ?? null
            }),
            memoryStack: bcvMemoryStack,
            memoryStackKey: 'vgap_bcv_stack'
        });

        // MAGIA FINANCIERA: Guardamos el valor exacto con 4 o más decimales por detrás
        window.exactBcvRate = val;

        // Visualmente seguimos mostrando 2 decimales para que se vea limpio
        input.value = formatVE(val);

        getEl('lastUpdate').innerText = `Actualizado: ${date || new Intl.DateTimeFormat('es-VE', {timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit'}).format(new Date())} VEN`;
        badge.innerText = "AUTO";
        sync('ratebcv');
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
        const { val } = await _fetchRateCore({
            cacheDataKey: 'vgap_binance_data',
            cacheTimeKey: 'vgap_binance_time',
            url: 'https://ve.dolarapi.com/v1/dolares',
            extract: (data) => {
                const binData = Array.isArray(data) ? data.find(item => item.fuente === 'paralelo') : null;
                return { value: binData?.promedio ?? null, date: null };
            },
            memoryStack: binanceMemoryStack,
            memoryStackKey: 'vgap_binance_stack'
        });

        // MAGIA FINANCIERA: Guardamos el valor exacto de Binance por detrás
        window.exactBinanceRate = val;

        input.value = formatVE(val);
        badge.innerText = "AUTO";
        sync('ratebinance');
    } catch (e) {
        console.error("Error cargando Binance:", e);
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBinance(), 1000);
    }
};

// --- GRÁFICOS ---
// Chart.js (CDN) solo se descarga la primera vez que el usuario abre el
// histórico, en vez de siempre al cargar la app (ahorra datos y arranque más rápido).
let chartJsLoadingPromise = null;
const ensureChartJsLoaded = () => {
    if (window.Chart) return Promise.resolve();
    if (chartJsLoadingPromise) return chartJsLoadingPromise;
    chartJsLoadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
    return chartJsLoadingPromise;
};

window.openChartModal = async () => {
    getEl('chartModal').classList.remove('hidden');
    try {
        await ensureChartJsLoaded();
    } catch (e) {
        console.error('No se pudo cargar Chart.js:', e);
        return;
    }
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

// --- REFRESCO AUTOMÁTICO EN TIEMPO REAL ---
// La tasa BCV suele actualizarse en la tarde; si la pestaña queda abierta,
// antes solo se pedía una vez al cargar y se quedaba pegada a esa tasa todo
// el día. Ahora se revisa periódicamente y también al volver a la pestaña,
// para reflejar el cambio apenas la fuente lo publique, sin recargar la página.
const refreshRatesIfAuto = () => {
    if (isBcvApi) fetchBcvOnly();
    if (isBinanceApi) fetchBinanceOnly();
};

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

    // Revisa cada CACHE_MINUTES si ya hay tasa nueva (fetchBcvOnly/fetchBinanceOnly
    // solo pegan a la API si el caché venció, así que esto es barato de sobra).
    setInterval(refreshRatesIfAuto, CACHE_MINUTES * 60 * 1000);

    // Si el usuario minimiza o cambia de pestaña y vuelve más tarde (ej. volvió
    // en la tarde cuando el BCV ya publicó su nueva tasa), refresca al instante.
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refreshRatesIfAuto();
    });

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
    // Si estamos en AUTO usamos el número exacto, si estamos en MANUAL usamos lo que el usuario escribió
    const bcv = (isBcvApi && window.exactBcvRate > 0) ? window.exactBcvRate : (getRawNumber(getEl('rateBcv').value) || 1);
    const p2p = (isBinanceApi && window.exactBinanceRate > 0) ? window.exactBinanceRate : (getRawNumber(getEl('rateBinance').value) || 1);
    
    // USDT_FEE (0.06, monto FIJO en USDT) es la comisión que Binance P2P cobra
    // al vender USDT por Bs. SOLO se aplica en la conversión USDT<->Bs.
    // La conversión USD/BCV<->Bs (líneas de abajo con "bcv") NUNCA lleva este fee:
    // ese es tu monto oficial puro, sin descuentos de P2P.
    const com = USDT_FEE;
    const usd = getEl('inputUsd'), usdt = getEl('inputUsdt'), bs = getEl('inputBs');
    
    if (origin === 'usd' || origin === 'ratebcv') {
        const v = getRawNumber(usd.value);
        if(usd.value === "") { bs.value = ""; usdt.value = ""; } 
        else {
            bs.value = formatVE(v * bcv); // BCV puro, sin fee
            usdt.value = formatVE((v * bcv / p2p) + com); // cuánto USDT necesitás vender (con fee) para llegar a ese mismo monto en Bs
        }
    } else if (origin === 'usdt') {
        const v = getRawNumber(usdt.value);
        if(usdt.value === "") { bs.value = ""; usd.value = ""; } 
        else {
            const neto = v > com ? v - com : 0; // Binance te liquida v - 0.06
            bs.value = neto > 0 ? formatVE(neto * p2p) : "";
            usd.value = neto > 0 ? formatVE(neto * p2p / bcv) : "";
        }
    } else if (origin === 'bs' || origin === 'ratebinance') {
        const v = getRawNumber(bs.value);
        if(bs.value === "") { usd.value = ""; usdt.value = ""; } 
        else {
            usd.value = v > 0 ? formatVE(v / bcv) : ""; // BCV puro, sin fee
            usdt.value = v > 0 ? formatVE((v / p2p) + com) : ""; // fee sumado de vuelta
        }
    }
    updateUI();
};

const updateUI = () => {
    const bcv = (isBcvApi && window.exactBcvRate > 0) ? window.exactBcvRate : (getRawNumber(getEl('rateBcv').value) || 1);
    const p2p = (isBinanceApi && window.exactBinanceRate > 0) ? window.exactBinanceRate : (getRawNumber(getEl('rateBinance').value) || 1);
    
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
