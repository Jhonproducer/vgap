const getEl = (id) => document.getElementById(id);

let isBcvApi = true; 
let isBinanceApi = true; 

let binanceMemoryStack = [localStorage.getItem('vgap_binance') || "613.54"];
let bcvMemoryStack = [localStorage.getItem('vgap_bcv') || "421.87"];

let historicalChartInstance = null;
let currentChartType = 'paralelo'; 
let rawHistoryData = { oficial: [], paralelo: [] };

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
        input.value = bcvMemoryStack[bcvMemoryStack.length - 1];
        sync('ratebcv');
        container.classList.add('unlocked');
        input.focus();
    }
};

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
        input.value = binanceMemoryStack[binanceMemoryStack.length - 1];
        sync('ratebinance');
        input.focus();
    }
};

// --- MOTOR INTELIGENTE: USA EL HISTORIAL PARA LA TASA PRINCIPAL ---
window.fetchBcvOnly = async () => {
    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');

    try {
        // Consultamos la API de históricos porque tú mismo viste que ahí sí está el dato nuevo
        const r = await fetch('https://ve.dolarapi.com/v1/historicos/dolares?t=' + Date.now());
        const data = await r.json();
        
        // Filtramos solo BCV y ordenamos por fecha (el más reciente al final)
        const bcvHist = data.filter(d => d.fuente === 'oficial')
                            .sort((a,b) => new Date(a.fecha) - new Date(b.fecha));

        if (bcvHist.length > 0) {
            const latest = bcvHist[bcvHist.length - 1];
            input.value = parseFloat(latest.promedio).toFixed(2);
            
            // Guardamos la data para no volver a descargarla al abrir el gráfico
            rawHistoryData.oficial = bcvHist.slice(-15);
            
            const options = { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
            getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', options).format(new Date())} VEN`;
            
            badge.innerText = "AUTO";
            sync('ratebcv');
        } else { throw new Error(); }
    } catch (e) {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBcv(), 1000); 
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
            input.value = parseFloat(binData.promedio).toFixed(2);
            badge.innerText = "AUTO";
            sync('ratebinance');
        }
    } catch (e) {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBinance(), 1000);
    }
};

window.openChartModal = async () => {
    getEl('chartModal').classList.remove('hidden');
    // Si por alguna razón no hay data de Binance, la buscamos
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
            plugins: { legend: {display: false}, tooltip: { mode: 'index', intersect: false } },
            scales: {
                x: { ticks: {color: isDark ? '#8E8E93' : '#636366'} },
                y: { grid: {color: isDark ? '#333335' : '#D1D1D6', borderDash: [5,5]}, ticks: {color: isDark ? '#8E8E93' : '#636366'} }
            }
        }
    });
}

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
        getEl(id).addEventListener('input', () => sync(id.replace('input', '').toLowerCase()));
    });
};

const sync = (origin) => {
    const bcv = parseFloat(getEl('rateBcv').value) || 1;
    const p2p = parseFloat(getEl('rateBinance').value) || 1;
    const com = 0.06;
    const usd = getEl('inputUsd'), usdt = getEl('inputUsdt'), bs = getEl('inputBs');
    if (origin === 'usd' || origin === 'ratebcv') {
        const v = parseFloat(usd.value) || 0;
        bs.value = v > 0 ? (v * bcv).toFixed(2) : "";
        usdt.value = v > 0 ? ((v * bcv / p2p) + com).toFixed(2) : "";
    } else if (origin === 'usdt') {
        const v = parseFloat(usdt.value) || 0;
        const neto = v > com ? v - com : 0;
        bs.value = neto > 0 ? (neto * p2p).toFixed(2) : "";
        usd.value = neto > 0 ? (neto * p2p / bcv).toFixed(2) : "";
    } else if (origin === 'bs' || origin === 'ratebinance') {
        const v = parseFloat(bs.value) || 0;
        usd.value = v > 0 ? (v / bcv).toFixed(2) : "";
        usdt.value = v > 0 ? ((v / p2p) + com).toFixed(2) : "";
    }
    updateUI();
};

const updateUI = () => {
    const bcv = parseFloat(getEl('rateBcv').value) || 1, p2p = parseFloat(getEl('rateBinance').value) || 1, bs = parseFloat(getEl('inputBs').value) || 0;
    getEl('bigBsDisplay').innerText = new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2}).format(bs) + " Bs";
    getEl('powerUsd').innerText = bs > 0 ? (bs / bcv).toFixed(2) : "0.00";
    getEl('brechaBadge').innerText = (((p2p - bcv)/bcv)*100).toFixed(2) + "%";
    getEl('factorBadge').innerText = (p2p/bcv).toFixed(2) + "x";
};

window.copyToClipboard = async () => {
    const txt = getEl('bigBsDisplay').innerText.split(' ')[0].replace(/[^\d,]/g, '').replace(',', '.');
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
