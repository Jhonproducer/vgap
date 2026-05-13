const getEl = (id) => document.getElementById(id);
let isBcvApi = true; let isBinanceApi = true; 
let binanceMemoryStack = JSON.parse(localStorage.getItem('vgap_binance_stack')) || ["613.54"];
let bcvMemoryStack = JSON.parse(localStorage.getItem('vgap_bcv_stack')) || ["421.87"];
let historicalChartInstance = null; let currentChartType = 'paralelo'; 
let rawHistoryData = { oficial: [], paralelo: [] };

const formatVE = (num) => new Intl.NumberFormat('es-VE', {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(num);
const getRawNumber = (str) => { if (!str) return 0; const d = String(str).replace(/\D/g, ''); return d ? parseInt(d, 10) / 100 : 0; };

window.startApp = (t) => {
    document.body.setAttribute('data-theme', t); getEl('themeToggleCheckbox').checked = t === 'dark';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', t === 'dark' ? '#000000' : '#F2F2F7');
    localStorage.setItem('vgap_theme_saved', t); getEl('welcomeScreen').classList.add('hidden'); getEl('mainApp').style.opacity = '1';
};

window.toggleThemeSwitch = () => {
    const isD = getEl('themeToggleCheckbox').checked; const t = isD ? 'dark' : 'light';
    document.body.setAttribute('data-theme', t); document.querySelector('meta[name="theme-color"]').setAttribute('content', isD ? '#000000' : '#F2F2F7');
    localStorage.setItem('vgap_theme_saved', t); if(historicalChartInstance) renderChartJs(); 
};

window.toggleBcv = async () => {
    isBcvApi = !isBcvApi; const badge = getEl('badgeBcv'); const input = getEl('rateBcv');
    if (isBcvApi) { badge.innerText = "..."; badge.className = "mode-badge api-bcv"; input.disabled = true; await fetchBcvOnly(); } 
    else { badge.innerText = "MANUAL"; badge.className = "mode-badge manual-mode"; input.disabled = false; input.value = formatVE(parseFloat(bcvMemoryStack[bcvMemoryStack.length - 1])); sync('ratebcv'); input.focus(); }
};

window.toggleBinance = async () => {
    isBinanceApi = !isBinanceApi; const badge = getEl('badgeBinance'); const input = getEl('rateBinance');
    if (isBinanceApi) { badge.innerText = "..."; badge.className = "mode-badge api-binance"; input.disabled = true; await fetchBinanceOnly(); } 
    else { badge.innerText = "MANUAL"; badge.className = "mode-badge manual-mode"; input.disabled = false; input.value = formatVE(parseFloat(binanceMemoryStack[binanceMemoryStack.length - 1])); sync('ratebinance'); input.focus(); }
};

window.fetchBcvOnly = async () => {
    const badge = getEl('badgeBcv'); const input = getEl('rateBcv');
    try {
        // PETICIÓN A PYDOLARVENEZUELA (MONITOR BCV INSTANTÁNEO)
        const r = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv&t=' + Date.now());
        const data = await r.json();
        const price = data.monitors && data.monitors.usd ? parseFloat(String(data.monitors.usd.price).replace(',', '.')) : null;
        if (price) {
            input.value = formatVE(price);
            if(price.toFixed(2) !== bcvMemoryStack[bcvMemoryStack.length-1]) { bcvMemoryStack.push(price.toFixed(2)); localStorage.setItem('vgap_bcv_stack', JSON.stringify(bcvMemoryStack)); }
            getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', {timeZone: 'America/Caracas', hour: '2-digit', minute: '2-digit', hour12: true}).format(new Date())} VEN`;
            badge.innerText = "AUTO"; sync('ratebcv');
        }
    } catch (e) { badge.innerText = "ERROR"; setTimeout(() => window.toggleBcv(), 1000); }
};

window.fetchBinanceOnly = async () => {
    const badge = getEl('badgeBinance'); const input = getEl('rateBinance');
    try {
        const r = await fetch('https://ve.dolarapi.com/v1/dolares?t=' + Date.now());
        const d = await r.json(); const bin = d.find(i => i.fuente === 'paralelo');
        if (bin) {
            const val = parseFloat(bin.promedio); input.value = formatVE(val);
            if(val.toFixed(2) !== binanceMemoryStack[binanceMemoryStack.length-1]) { binanceMemoryStack.push(val.toFixed(2)); localStorage.setItem('vgap_binance_stack', JSON.stringify(binanceMemoryStack)); }
            badge.innerText = "AUTO"; sync('ratebinance');
        }
    } catch (e) { badge.innerText = "ERROR"; setTimeout(() => window.toggleBinance(), 1000); }
};

window.openChartModal = async () => {
    getEl('chartModal').classList.remove('hidden');
    if(rawHistoryData.paralelo.length === 0) {
        try {
            const r = await fetch('https://ve.dolarapi.com/v1/historicos/dolares?t=' + Date.now());
            const d = await r.json();
            rawHistoryData.oficial = d.filter(k => k.fuente === 'oficial').sort((a,b) => new Date(a.fecha) - new Date(b.fecha)).slice(-15);
            rawHistoryData.paralelo = d.filter(k => k.fuente === 'paralelo').sort((a,b) => new Date(a.fecha) - new Date(b.fecha)).slice(-15);
        } catch(e) {}
    }
    renderChartJs();
};

window.closeChartModal = () => getEl('chartModal').classList.add('hidden');
window.switchChartType = (t) => { currentChartType = t; getEl('tabChartParalelo').classList.toggle('active', t === 'paralelo'); getEl('tabChartBcv').classList.toggle('active', t === 'oficial'); renderChartJs(); };

function renderChartJs() {
    const ctx = getEl('historyChart').getContext('2d'); const isD = document.body.getAttribute('data-theme') === 'dark';
    const list = rawHistoryData[currentChartType]; if(!list || list.length === 0) return;
    const labels = list.map(d => new Date(d.fecha + "T12:00:00").toLocaleDateString('es-VE', {day: '2-digit', month: 'short'}));
    const prices = list.map(d => parseFloat(d.promedio)); const isP = currentChartType === 'paralelo';
    if(historicalChartInstance) historicalChartInstance.destroy();
    historicalChartInstance = new Chart(ctx, {
        type: 'line', data: { labels: labels, datasets: [{ data: prices, borderColor: isP ? '#FF9F0A' : '#0A84FF', backgroundColor: isP ? 'rgba(255, 159, 10, 0.15)' : 'rgba(10, 132, 255, 0.15)', borderWidth: 3, fill: true, pointRadius: 4, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display: false}, tooltip: { mode: 'index', intersect: false, callbacks: { label: (c) => 'Bs.S ' + formatVE(c.parsed.y) } } }, scales: { x: { ticks: {color: isD ? '#8E8E93' : '#636366'} }, y: { grid: {color: isD ? '#333335' : '#D1D1D6', borderDash: [5,5]}, ticks: {color: isD ? '#8E8E93' : '#636366'} } } }
    });
}

window.onload = () => {
    const s = localStorage.getItem('vgap_theme_saved'); if (s) { getEl('welcomeScreen').style.display = 'none'; document.body.setAttribute('data-theme', s); getEl('themeToggleCheckbox').checked = s === 'dark'; getEl('mainApp').style.opacity = '1'; }
    fetchBcvOnly(); fetchBinanceOnly(); 
    ['inputUsd', 'inputUsdt', 'inputBs', 'rateBcv', 'rateBinance'].forEach(id => {
        getEl(id).addEventListener('input', (e) => { if (e.target.value === "") { sync(id.replace('input', '').toLowerCase()); return; } e.target.value = formatVE(getRawNumber(e.target.value)); sync(id.replace('input', '').toLowerCase()); });
    });
};

const sync = (o) => {
    const b = getRawNumber(getEl('rateBcv').value) || 1; const p = getRawNumber(getEl('rateBinance').value) || 1; const c = 0.06;
    const usd = getEl('inputUsd'), usdt = getEl('inputUsdt'), bs = getEl('inputBs');
    if (o === 'usd' || o === 'ratebcv') { const v = getRawNumber(usd.value); bs.value = v ? formatVE(v * b) : ""; usdt.value = v ? formatVE((v * b / p) + c) : ""; } 
    else if (o === 'usdt') { const v = getRawNumber(usdt.value); const n = v > c ? v - c : 0; bs.value = n ? formatVE(n * p) : ""; usd.value = n ? formatVE(n * p / b) : ""; } 
    else if (o === 'bs' || o === 'ratebinance') { const v = getRawNumber(bs.value); usd.value = v ? formatVE(v / b) : ""; usdt.value = v ? formatVE((v / p) + c) : ""; }
    updateUI();
};

const updateUI = () => {
    const b = getRawNumber(getEl('rateBcv').value) || 1; const p = getRawNumber(getEl('rateBinance').value) || 1; 
    const bs = getRawNumber(getEl('inputBs').value) || 0; const ut = getRawNumber(getEl('inputUsdt').value) || 0;
    getEl('bigBsDisplay').innerText = "Bs.S " + formatVE(bs); const pow = bs ? (bs / b) : 0; getEl('powerUsd').innerText = formatVE(pow);
    getEl('brechaBadge').innerText = formatVE(((p - b)/b)*100) + "%"; getEl('factorBadge').innerText = formatVE(p/b) + "x";
    const net = ut > 0.06 ? ut - 0.06 : 0;
    if (bs > 0 && net > 0 && pow > net) { getEl('extraProfit').innerText = "+$" + formatVE(pow - net); getEl('profitArea').style.display = 'inline-block'; } 
    else { getEl('profitArea').style.display = 'none'; }
};

window.copyToClipboard = async () => { const t = getEl('bigBsDisplay').innerText.replace('Bs.S ', ''); await navigator.clipboard.writeText(t); const b = document.querySelector('.btn-copy-elegant'); b.innerText = "¡COPIADO!"; setTimeout(() => b.innerText = "COPIAR MONTO", 1000); };
window.copyInputBs = async () => { const v = getEl('inputBs').value; if(v) await navigator.clipboard.writeText(v); };
window.resetAll = () => { ['inputUsd', 'inputUsdt', 'inputBs'].forEach(id => getEl(id).value = ""); updateUI(); };
