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
    
    if(chartExpanded.bin) renderChartGraph('bin'); 
    if(chartExpanded.bcv) renderChartGraph('bcv'); 
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
            const options = { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
            getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', options).format(apiDate)} VEN`;
            badge.innerText = "AUTO";
            sync('ratebcv');
        }
    } catch (e) {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBcv(), 1000);
    }
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
    } catch (e) {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBinance(), 1000);
    }
};

// ======= INITIALIZATION ===========
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
    
    // Inicia el procesamiento silencioso de gráficos
    backgroundPreloadChart(); 

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
                // Si el grafico está abierto, actualiza el punto final
                if (vGapChartHistory.bin.length > 0) {
                    vGapChartHistory.bin[vGapChartHistory.bin.length-1].val = parseFloat(val);
                    if(chartExpanded.bin) renderChartGraph('bin');
                }
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
                if (vGapChartHistory.bcv.length > 0) {
                    vGapChartHistory.bcv[vGapChartHistory.bcv.length-1].val = parseFloat(val);
                    if(chartExpanded.bcv) renderChartGraph('bcv');
                }
            }
        }
    });
    
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


// =========================================================================
// MÓDULO EXPERTO DE GRÁFICOS: AISLADOS Y NORMALIZADOS
// =========================================================================

let vGapChartHistory = { bcv: [], bin: [] }; 
let chartExpanded = { bcv: false, bin: false };

window.toggleChart = (type) => {
    chartExpanded[type] = !chartExpanded[type];
    getEl(`content-${type}`).classList.toggle('collapsed');
    getEl(`chevron-${type}`).classList.toggle('rotate');
    
    // Fuerza Resize Render nativo solo de la caja que se abrió
    if(chartExpanded[type]) {
        setTimeout(() => { renderChartGraph(type); }, 150);
    }
}

const formatChartDateLabel = (date) => {
    const month = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][date.getMonth()];
    return `${String(date.getDate()).padStart(2,'0')} ${month}`;
}

// 1. Petición única, y luego EL EXPERTO: Normalización de Fechas para tapar huecos
async function backgroundPreloadChart() {
   try {
       const resp = await fetch('https://ve.dolarapi.com/v1/historicos/dolares?t=' + new Date().getTime());
       const rawArray = await resp.json();
       
       let rawOfi = [], rawPara = [];
       if (Array.isArray(rawArray)) {
           rawOfi = rawArray.filter(k => k.fuente === 'oficial');
           rawPara = rawArray.filter(k => k.fuente === 'paralelo');
       }
       
       // El truco maestro: Normalizamos ambas a 30 días exactos, arrastrando el precio si el API se atrasa.
       vGapChartHistory.bcv = normalizeHistoryArray(rawOfi, parseFloat(getEl('rateBcv').value) || 42.0);
       vGapChartHistory.bin = normalizeHistoryArray(rawPara, parseFloat(getEl('rateBinance').value) || 600.0);
       
   } catch(e) {
       vGapChartHistory.bcv = genMock(parseFloat(getEl('rateBcv').value) || 42.0);
       vGapChartHistory.bin = genMock(parseFloat(getEl('rateBinance').value) || 600.0);
   }
}

// ALGORITMO DE NORMALIZACIÓN (Cura el problema de "Binance atrasado")
function normalizeHistoryArray(rawArray, currentCalculatedRate) {
    if (!rawArray || rawArray.length === 0) return genMock(currentCalculatedRate);
    
    // Ordenamos de viejo a nuevo
    rawArray.sort((a,b) => new Date(a.fecha+"T12:00:00") - new Date(b.fecha+"T12:00:00"));
    
    let processed = [];
    let today = new Date();
    today.setHours(23,59,59,999);
    
    for (let i = 29; i >= 0; i--) {
        let targetDate = new Date();
        targetDate.setDate(targetDate.getDate() - i);
        targetDate.setHours(12,0,0,0);
        
        // Busca el último dato disponible hasta ese día (arrastra el precio en días feriados)
        let validPoint = rawArray[0]; 
        for(let j = 0; j < rawArray.length; j++) {
            let pDate = new Date(rawArray[j].fecha + "T12:00:00");
            if (pDate <= targetDate) validPoint = rawArray[j];
            else break;
        }
        processed.push({ d: targetDate, val: parseFloat(validPoint.promedio) });
    }
    
    // El punto final de la derecha ES el valor en vivo de tu calculadora
    processed[processed.length - 1].val = currentCalculatedRate;
    processed[processed.length - 1].d = new Date();
    return processed;
}

// Emulador de caída si te quedas sin internet
function genMock(baseValue) {
   let simulatedArray = []; 
   let hoyBaseRef = new Date();
   let walkerVar = baseValue * 0.94; 
   for (let nOffsetT = 29; nOffsetT >= 0; nOffsetT--) {
      let dxTmpIndex = new Date(hoyBaseRef);
      dxTmpIndex.setDate(dxTmpIndex.getDate() - nOffsetT);
      walkerVar = walkerVar + (walkerVar * (Math.random() * 0.012 - 0.003)); 
      simulatedArray.push({ d: dxTmpIndex, val: walkerVar });
   }
   simulatedArray[simulatedArray.length -1].val = baseValue; 
   return simulatedArray;
}

// 2. Dibuja cada gráfico en su propio canvas aislado
function renderChartGraph(type) {
   const cvs = getEl(`canvas-${type}`);
   if (!cvs || !chartExpanded[type]) return;
   
   const themeKey = document.body.getAttribute('data-theme') || 'light';
   // Colores designados (Naranja para binance, Azul para BCV)
   const mainColor = type === 'bin' ? '#FF9F0A' : '#0A84FF';
   const uiGreen = '#32D74B';
   const uiRed = '#FF453A';
   
   const rectBound = cvs.parentElement.getBoundingClientRect();
   if(rectBound.width === 0) return;

   const dprScaleFactor = window.devicePixelRatio || 1;
   cvs.width = rectBound.width * dprScaleFactor;
   cvs.height = rectBound.height * dprScaleFactor;
   const ctx = cvs.getContext('2d');
   ctx.scale(dprScaleFactor, dprScaleFactor);
   
   let logicalW = rectBound.width;
   let logicalH = rectBound.height;
   
   const historyData = vGapChartHistory[type] || [];
   if(historyData.length === 0) return;
   
   const mapRates = historyData.map(v => v.val);
   const absMax = Math.max(...mapRates);
   const absMin = Math.min(...mapRates);
   
   const gapDiff = absMax - absMin === 0 ? 1 : absMax - absMin;
   const pTopPadding = absMax + (gapDiff * 0.20); 
   const pBotPadding = absMin - (gapDiff * 0.20); 

   const startVal = mapRates[0];
   const endVal = mapRates[mapRates.length-1];
   
   // Determinar si la tendencia fue alza o baja
   const trendColor = endVal >= startVal ? uiGreen : uiRed;
   const gradientColor = type === 'bin' ? 'rgba(255, 159, 10, 0.25)' : 'rgba(10, 132, 255, 0.25)';
   
   const updateLabels = (pointIdx) => {
        let activePoint = historyData[pointIdx];
        getEl(`hudDate-${type}`).innerText = formatChartDateLabel(activePoint.d);
        const hudValueEl = getEl(`hudValue-${type}`);
        hudValueEl.innerText = new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2}).format(activePoint.val) + ' Bs';
        hudValueEl.style.color = activePoint.val >= historyData[Math.max(0, pointIdx - 1)].val ? uiGreen : uiRed;
        
        drawPath(pointIdx);
   }

   function drawPath(focusIndex = null) {
      ctx.clearRect(0,0, logicalW, logicalH);
      
      let fillGradient= ctx.createLinearGradient(0, 0, 0, logicalH);
      fillGradient.addColorStop(0, gradientColor);
      fillGradient.addColorStop(1, "rgba(0,0,0,0)");
      
      const pts = [];
      historyData.forEach((pt, idx, arr) => {
          let cx = (idx / (arr.length - 1)) * logicalW; 
          let cy = logicalH - ((pt.val - pBotPadding) / (pTopPadding - pBotPadding) * logicalH);
          pts.push({x: cx, y: cy, index: idx});
      });
      
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      
      const fillPath = new Path2D(ctx.path || ''); 
      ctx.lineTo(logicalW, logicalH);
      ctx.lineTo(0, logicalH);
      ctx.fillStyle = fillGradient; 
      ctx.fill();

      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = mainColor;
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();

      if(focusIndex !== null) {
          const hoveredPt = pts[focusIndex];
          const trackColor = themeKey === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 1; 
          ctx.strokeStyle = trackColor;
          ctx.beginPath();
          ctx.moveTo(hoveredPt.x, 0); 
          ctx.lineTo(hoveredPt.x, logicalH); 
          ctx.stroke();

          ctx.beginPath();
          ctx.fillStyle = themeKey === 'dark' ? '#000000' : '#ffffff'; 
          ctx.lineWidth = 4;
          ctx.strokeStyle = mainColor; 
          ctx.arc(hoveredPt.x, hoveredPt.y, 6, 0, Math.PI * 2); 
          ctx.fill(); 
          ctx.stroke(); 
      }
   }

   const handleTouchMove = (e) => {
       const bounds = cvs.getBoundingClientRect(); 
       let clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX; 
       let xPos = Math.max(0, Math.min(bounds.width, clientX - bounds.left)); 
       const snappedIndex = Math.round((xPos / bounds.width) * (historyData.length - 1)); 
       updateLabels(snappedIndex); 
   };

   const freshCanvas = cvs.cloneNode(true);
   cvs.parentNode.replaceChild(freshCanvas, cvs);

   freshCanvas.addEventListener('pointermove', handleTouchMove);
   freshCanvas.addEventListener('touchmove', handleTouchMove, {passive: true}); 

   freshCanvas.addEventListener('pointerleave', () => {
        updateLabels(historyData.length - 1); 
        drawPath(null); 
   });

   updateLabels(historyData.length - 1); 
   drawPath(null); 
}
