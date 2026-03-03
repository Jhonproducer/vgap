const getEl = (id) => document.getElementById(id);

let isBcvApi = true; 
let isBinanceApi = true; 

let binanceMemoryStack = [localStorage.getItem('vgap_binance') || "613.54"];
let bcvMemoryStack = [localStorage.getItem('vgap_bcv') || "421.87"];

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

// --- BUSCADOR BCV ---
window.fetchBcvOnly = async () => {
    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');

    try {
        const r = await fetch('https://ve.dolarapi.com/v1/dolares?t=' + new Date().getTime());
        const data = await r.json();
        const bcvData = data.find(item => item.fuente === 'oficial');
        
        if (bcvData && bcvData.promedio) {
            input.value = parseFloat(bcvData.promedio).toFixed(2);
            const apiDate = new Date(bcvData.fechaActualizacion);
            const options = { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
            getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', options).format(apiDate)} VEN`;
            badge.innerText = "AUTO";
            sync('ratebcv');
        } else { throw new Error("Sin datos de BCV"); }
    } catch (e) {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBcv(), 1000);
    }
};

// --- BUSCADOR BINANCE ---
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
        } else { throw new Error("Sin datos de Paralelo"); }
    } catch (e) {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBinance(), 1000);
    }
};

// ==========================================
// EL EASTER EGG: MODAL DEL GRÁFICO (SEGURO)
// ==========================================
window.openChartModal = () => {
    getEl('chartModal').classList.remove('hidden');
    getEl('chartBody').innerHTML = '<p style="text-align:center; font-size:12px; color:var(--text-dim);">Cargando historial...</p>';
    fetchAndDrawCharts(); // Solo consume internet cuando abres el modal
};

window.closeChartModal = () => {
    getEl('chartModal').classList.add('hidden');
};

const fetchAndDrawCharts = async () => {
    try {
        const r = await fetch('https://ve.dolarapi.com/v1/historicos/dolares?t=' + new Date().getTime());
        const histData = await r.json();
        
        // Filtra los últimos 7 días de cada uno (vienen de nuevo a viejo, así que invertimos)
        const histOficial = histData.filter(h => h.fuente === 'oficial').slice(0, 7).reverse();
        const histParalelo = histData.filter(h => h.fuente === 'paralelo').slice(0, 7).reverse();
        
        // Inyectamos el HTML del gráfico dentro del modal
        let htmlContent = "";
        
        if(histParalelo.length > 0) {
            const minP = Math.min(...histParalelo.map(h => h.promedio));
            const maxP = Math.max(...histParalelo.map(h => h.promedio));
            htmlContent += `
                <div class="chart-box">
                    <div class="chart-title"><span>PARALELO (7 DÍAS)</span> <span style="color:var(--orange)">Bs ${maxP.toFixed(2)}</span></div>
                    <div class="chart-svg-wrap">
                        <svg viewBox="0 0 100 30" preserveAspectRatio="none" style="width:100%; height:100%; overflow:visible;">
                            <path class="spark-line binance" d="${createSVGPath(histParalelo)}"></path>
                        </svg>
                    </div>
                </div>`;
        }
        
        if(histOficial.length > 0) {
            const minO = Math.min(...histOficial.map(h => h.promedio));
            const maxO = Math.max(...histOficial.map(h => h.promedio));
            htmlContent += `
                <div class="chart-box">
                    <div class="chart-title"><span>BCV (7 DÍAS)</span> <span style="color:var(--blue)">Bs ${maxO.toFixed(2)}</span></div>
                    <div class="chart-svg-wrap">
                        <svg viewBox="0 0 100 30" preserveAspectRatio="none" style="width:100%; height:100%; overflow:visible;">
                            <path class="spark-line bcv" d="${createSVGPath(histOficial)}"></path>
                        </svg>
                    </div>
                </div>`;
        }
        
        getEl('chartBody').innerHTML = htmlContent || "<p>Sin datos históricos.</p>";
        
    } catch (e) {
        getEl('chartBody').innerHTML = '<p style="color:var(--red); text-align:center;">Error al cargar el gráfico.</p>';
    }
};

// Generador matemático de la línea del gráfico
const createSVGPath = (dataArray) => {
    const prices = dataArray.map(h => parseFloat(h.promedio));
    const minPrice = Math.min(...prices) * 0.999; 
    const maxPrice = Math.max(...prices) * 1.001; 
    
    if (minPrice === maxPrice) return `M 0,15 L 100,15`; // Línea recta si no cambia
    
    let path = "M ";
    const stepX = 100 / (prices.length - 1);
    
    for (let i = 0; i < prices.length; i++) {
        const x = i * stepX;
        const y = 30 - ((prices[i] - minPrice) / (maxPrice - minPrice) * 30);
        path += `${x.toFixed(2)},${y.toFixed(2)} `;
        if (i < prices.length - 1) path += " L ";
    }
    return path;
};
// ==========================================

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
