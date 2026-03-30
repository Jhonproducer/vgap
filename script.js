const getEl = (id) => document.getElementById(id);

let isBcvApi = true; 
let isBinanceApi = true; 

let binanceMemoryStack = [localStorage.getItem('vgap_binance') || "613.54"];
let bcvMemoryStack = [localStorage.getItem('vgap_bcv') || "421.87"];

// Para el Gráfico Modal Chart.js
let historicalChartInstance = null;
let currentChartType = 'paralelo'; 
let rawHistoryData = { oficial: [], paralelo: [] };

// --- PANTALLA DE BIENVENIDA Y TEMA ---
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
    
    if(historicalChartInstance) {
        renderChartJs(); 
    }
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
        input.value = bcvMemoryStack[bcvMemoryStack.length - 1];
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
        input.value = binanceMemoryStack[binanceMemoryStack.length - 1];
        sync('ratebinance');
        input.focus();
    }
};

// --- BUSCADOR BCV (USANDO LA NUEVA API MÁS RÁPIDA DE PYDOLAR) ---
window.fetchBcvOnly = async () => {
    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');

    try {
        const r = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv&t=' + new Date().getTime());
        const data = await r.json();
        
        // Extraemos el valor directo del USD de la nueva API
        const bcvData = data.monitors && data.monitors.usd;
        
        if (bcvData && bcvData.price) {
            input.value = parseFloat(bcvData.price).toFixed(2);
            
            const options = { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
            getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', options).format(new Date())} VEN`;
            
            badge.innerText = "AUTO";
            sync('ratebcv');
        } else {
            throw new Error("Sin datos de BCV");
        }
    } catch (e) {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBcv(), 1000); 
    }
};

// --- BUSCADOR PARALELO (BINANCE) ---
window.fetchBinanceOnly = async () => {
    const badge = getEl('badgeBinance');
    const input = getEl('rateBinance');

    try {
        const r = await fetch('https://ve.dolarapi.com/v1/dolares?t=' + new Date().getTime());
        const data = await r.json();
        
        const paraleloData = data.find(item => item.fuente === 'paralelo');
        
        if (paraleloData && paraleloData.promedio) {
            input.value = parseFloat(paraleloData.promedio).toFixed(2);
            badge.innerText = "AUTO";
            sync('ratebinance');
        } else {
            throw new Error("Sin datos de Paralelo");
        }
    } catch (e) {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBinance(), 1000);
    }
};

// --- EL GRÁFICO HISTÓRICO SEPARADO POR PESTAÑAS (CHART.JS) ---
window.openChartModal = async () => {
    getEl('chartModal').classList.remove('hidden');
    
    if(rawHistoryData.oficial.length === 0) {
        try {
            const r = await fetch('https://ve.dolarapi.com/v1/historicos/dolares?t=' + Date.now());
            const data = await r.json();
            
            // SEPARAMOS LA DATA PARA QUE LAS FECHAS NO CHOQUEN
            let dataOfi = data.filter(d => d.fuente === 'oficial')
                              .sort((a,b) => new Date(a.fecha) - new Date(b.fecha))
                              .slice(-15); 
            
            let dataPar = data.filter(d => d.fuente === 'paralelo')
                              .sort((a,b) => new Date(a.fecha) - new Date(b.fecha))
                              .slice(-15); 
            
            rawHistoryData.oficial = dataOfi;
            rawHistoryData.paralelo = dataPar;
        } catch(e) { 
            console.error("Error API Gráfico", e); 
        }
    }
    
    renderChartJs();
}

window.closeChartModal = () => {
    getEl('chartModal').classList.add('hidden');
}

window.switchChartType = (type) => {
    currentChartType = type;
    getEl('tabChartParalelo').classList.toggle('active', type === 'paralelo');
    getEl('tabChartBcv').classList.toggle('active', type === 'oficial');
    renderChartJs(); 
}

function renderChartJs() {
    const ctx = getEl('historyChart').getContext('2d');
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    
    const currentDataList = rawHistoryData[currentChartType];
    if(!currentDataList || currentDataList.length === 0) return;

    const labels = currentDataList.map(d => {
        let date = new Date(d.fecha + "T12:00:00");
        return date.toLocaleDateString('es-VE', {day: '2-digit', month: 'short'});
    });
    const prices = currentDataList.map(d => parseFloat(d.promedio));
    
    const isParalelo = currentChartType === 'paralelo';
    const color = isParalelo ? '#FF9F0A' : '#0A84FF';
    const bgColor = isParalelo ? 'rgba(255, 159, 10, 0.15)' : 'rgba(10, 132, 255, 0.15)';

    if(historicalChartInstance) {
        historicalChartInstance.destroy();
    }

    historicalChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: isParalelo ? 'Paralelo' : 'BCV',
                data: prices,
                borderColor: color,
                backgroundColor: bgColor,
                borderWidth: 3,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: color,
                tension: 0.3 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            plugins: {
                legend: {display: false},
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: isDark ? 'rgba(28,28,30,0.9)' : 'rgba(255,255,255,0.9)',
                    titleColor: isDark ? '#FFF' : '#000',
                    bodyColor: isDark ? '#FFF' : '#000',
                    borderColor: isDark ? '#333335' : '#D1D1D6',
                    borderWidth: 1,
                    displayColors: false,
                    callbacks: {
                        label: function(context) { 
                            return 'Bs ' + context.parsed.y.toFixed(2); 
                        }
                    }
                }
            },
            scales: {
                x: { 
                    grid: {display: false}, 
                    ticks: {color: isDark ? '#8E8E93' : '#636366', maxTicksLimit: 7} 
                },
                y: { 
                    grid: {color: isDark ? '#333335' : '#D1D1D6', borderDash: [5, 5]}, 
                    ticks: {color: isDark ? '#8E8E93' : '#636366'} 
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

// --- ARRANQUE Y EVENTOS PRINCIPALES ---
window.onload = () => {
    const savedTheme = localStorage.getItem('vgap_theme_saved');
    if (savedTheme) {
        getEl('welcomeScreen').style.display = 'none';
        document.body.setAttribute('data-theme', savedTheme);
        getEl('themeToggleCheckbox').checked = savedTheme === 'dark';
        document.querySelector('meta[name="theme-color"]').setAttribute('content', savedTheme === 'dark' ? '#000000' : '#F2F2F7');
        getEl('mainApp').style.opacity = '1';
    }

    fetchBcvOnly();
    fetchBinanceOnly(); 
    
    getEl('rateBinance').addEventListener('blur', (e) => {
        if(!isBinanceApi) {
            const val = e.target.value;
            if(!val || parseFloat(val) <= 0) {
                e.target.value = binanceMemoryStack[binanceMemoryStack.length - 1]; 
                sync('ratebinance');
            } else {
                binanceMemoryStack.push(val);
                if(binanceMemoryStack.length > 10) binanceMemoryStack.shift();
                localStorage.setItem('vgap_binance', val);
            }
        }
    });

    getEl('rateBcv').addEventListener('blur', (e) => {
        if(!isBcvApi) {
            const val = e.target.value;
            if(!val || parseFloat(val) <= 0) {
                e.target.value = bcvMemoryStack[bcvMemoryStack.length - 1]; 
                sync('ratebcv');
            } else {
                bcvMemoryStack.push(val);
                if(bcvMemoryStack.length > 10) bcvMemoryStack.shift();
                localStorage.setItem('vgap_bcv', val);
            }
        }
    });
    
    ['inputUsd', 'inputUsdt', 'inputBs', 'rateBcv', 'rateBinance'].forEach(id => {
        getEl(id).addEventListener('input', (e) => {
            sync(id.replace('input', '').toLowerCase());
        });
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
