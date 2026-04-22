const getEl = (id) => document.getElementById(id);

let isBcvApi = true; 
let isBinanceApi = true; 

let binanceMemoryStack = [localStorage.getItem('vgap_binance') || "613.54"];
let bcvMemoryStack = [localStorage.getItem('vgap_bcv') || "421.87"];

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
    renderActiveChartGraph(); 
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
            getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', {timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true}).format(apiDate)} VEN`;
            badge.innerText = "AUTO";
            sync('ratebcv');
        }
    } catch (e) { badge.innerText = "ERROR"; setTimeout(() => window.toggleBcv(), 1000); }
};

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
        }
    } catch (e) { badge.innerText = "ERROR"; setTimeout(() => window.toggleBinance(), 1000); }
};

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
    backgroundPreloadChart(); 
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
    const bcv = parseFloat(getEl('rateBcv').value) || 1;
    const p2p = parseFloat(getEl('rateBinance').value) || 1;
    const bs = parseFloat(getEl('inputBs').value) || 0;
    const usdtRaw = parseFloat(getEl('inputUsdt').value) || 0;

    getEl('bigBsDisplay').innerText = new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2}).format(bs) + " Bs";
    const power = bs > 0 ? (bs / bcv) : 0;
    getEl('powerUsd').innerText = power.toFixed(2);
    getEl('brechaBadge').innerText = (((p2p - bcv)/bcv)*100).toFixed(2) + "%";
    getEl('factorBadge').innerText = (p2p/bcv).toFixed(2) + "x";

    // CÁLCULO GANANCIA EXTRA
    const usdtNeto = usdtRaw > 0.06 ? usdtRaw - 0.06 : 0;
    if (bs > 0 && usdtNeto > 0) {
        const extra = power - usdtNeto;
        getEl('extraProfit').innerText = "+$" + extra.toFixed(2);
        getEl('profitArea').style.display = 'inline-block';
    } else {
        getEl('profitArea').style.display = 'none';
    }
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

// MÓDULO GRÁFICO (RESTAURADO EXACTO)
let vGapChartHistory = { oficial: [], paralelo: [] }; 
let currentGraphType = 'paralelo'; 
let chartIsExpanded = false;

window.toggleChart = () => {
    chartIsExpanded = !chartIsExpanded;
    getEl('chartContent').classList.toggle('collapsed');
    getEl('chartChevron').classList.toggle('rotate');
    if(chartIsExpanded) setTimeout(() => { renderActiveChartGraph(); }, 150);
}

window.switchChartType = (type) => {
    currentGraphType = type;
    getEl('tabBinChart').classList.toggle('active', type === 'paralelo');
    getEl('tabBcvChart').classList.toggle('active', type === 'oficial');
    renderActiveChartGraph(); 
}

const formatChartDateLabel = (date) => {
    const month = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][date.getMonth()];
    return `${String(date.getDate()).padStart(2,'0')} ${month}`;
}

async function backgroundPreloadChart() {
   try {
       const resp = await fetch('https://ve.dolarapi.com/v1/historicos/dolares?t=' + new Date().getTime());
       const data = await resp.json();
       let ofi = [], para = [];
       if (Array.isArray(data)) {
           data.forEach(k => {
               const tipo = String(k.fuente || "").toLowerCase();
               const target = tipo === 'oficial' ? ofi : para;
               if (k.historico) {
                   k.historico.forEach(pnt => target.push({ d: new Date(pnt.fecha), val: parseFloat(pnt.promedio) }));
               }
           });
       }
       vGapChartHistory.oficial = ofi.sort((a,b) => a.d - b.d);
       vGapChartHistory.paralelo = para.sort((a,b) => a.d - b.d);
   } catch(e) {}
}

function renderActiveChartGraph() {
   const cvs = getEl('ultraHistoryCanvas');
   if (!cvs || !chartIsExpanded) return;
   const themeKey = document.body.getAttribute('data-theme') || 'light';
   const rectBound = cvs.parentElement.getBoundingClientRect();
   const dpr = window.devicePixelRatio || 1;
   cvs.width = rectBound.width * dpr;
   cvs.height = rectBound.height * dpr;
   const ctx = cvs.getContext('2d');
   ctx.scale(dpr, dpr);
   const dStack = vGapChartHistory[currentGraphType] || [];
   if(dStack.length === 0) return;
   const mapRates = dStack.map(v => v.val);
   const max = Math.max(...mapRates), min = Math.min(...mapRates);
   const pTop = max + ((max-min)*0.2), pBot = min - ((max-min)*0.2);
   const color = dStack[dStack.length-1].val >= dStack[0].val ? '#32D74B' : '#FF453A';

   function drawPath(focusIndex = null) {
      ctx.clearRect(0,0, rectBound.width, rectBound.height);
      const pts = dStack.map((pt, i) => ({
          x: (i / (dStack.length - 1)) * rectBound.width,
          y: rectBound.height - ((pt.val - pBot) / (pTop - pBot) * rectBound.height)
      }));
      ctx.beginPath();
      ctx.lineWidth = 3; ctx.strokeStyle = color;
      pts.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
      ctx.stroke();
      if(focusIndex !== null) {
          const p = pts[focusIndex];
          ctx.beginPath(); ctx.strokeStyle = themeKey === 'dark' ? '#fff' : '#000'; ctx.moveTo(p.x, 0); ctx.lineTo(p.x, rectBound.height); ctx.stroke();
          ctx.beginPath(); ctx.fillStyle = color; ctx.arc(p.x, p.y, 6, 0, Math.PI*2); ctx.fill();
      }
   }
   drawPath(dStack.length - 1);
}
