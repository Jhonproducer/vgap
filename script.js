/**
 * @file V-GAP ULTRA - Core Logic
 * @description Motor principal de calculadora financiera y renderizado de gráficos nativos (Canvas API).
 * @architecture MVC-Lite en un solo archivo con protección de memoria (Fallback system).
 */

const getEl = (id) => document.getElementById(id);

let isBcvApi = true; 
let isBinanceApi = true; 

// --- STATE MANAGEMENT: MEMORY STACK ---
let binanceMemoryStack = [localStorage.getItem('vgap_binance') || "613.54"];
let bcvMemoryStack = [localStorage.getItem('vgap_bcv') || "421.87"];

// ==========================================
// MÓDULO 1: INTERFAZ Y TEMAS (UI MODULE)
// ==========================================
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
    renderActiveChartGraph(); // forzar repintar si despliegas gráfica theme visual colors map switch
};

// ==========================================
// MÓDULO 2: CONTROLADORES API (FETCH MODULE)
// ==========================================
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
        } else {
            throw new Error("Sin datos de BCV");
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
        } else {
            throw new Error("Sin datos");
        }
    } catch (e) {
        badge.innerText = "ERROR";
        setTimeout(() => window.toggleBinance(), 1000);
    }
};

// ==========================================
// MÓDULO 3: INITIALIZATION & CALCULADORA 
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
    
    // Enganche para el Modulo gráfico Historial invisible
    backgroundPreloadChart(); 

    // Listeners de memoria para Undo
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
    
    // Sincronización instantánea (0 latency)
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
// MÓDULO 4: GRÁFICO NATIVO INTERACTIVO (CANVAS ENGINE) 
// =========================================================================
let vGapChartHistory = { oficial: [], paralelo: [] }; 
let currentGraphType = 'paralelo'; 
let chartIsExpanded = false;

window.toggleChart = () => {
    chartIsExpanded = !chartIsExpanded;
    getEl('chartContent').classList.toggle('collapsed');
    getEl('chartChevron').classList.toggle('rotate');
    
    // Fuerza Resize Render nativo solo luego del display-grid CSS expansion mapping
    if(chartIsExpanded) {
        setTimeout(() => {
            renderActiveChartGraph(); 
        }, 150);
    }
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
       const dapiNodesArray = await resp.json();
       let foundValidosOfi = [], foundValidosPara = [];
       
       if (Array.isArray(dapiNodesArray)) {
           dapiNodesArray.forEach(k => {
               const tipoCasa = String(k.fuente || k.casa || k.nombre || "").toLowerCase();
               const isOfi = (tipoCasa === 'oficial');
               const targetPush = isOfi ? foundValidosOfi : foundValidosPara; 

               if (k.historico && Array.isArray(k.historico)) {
                   k.historico.forEach(pnt => { 
                       let dt = new Date(pnt.fecha || pnt.fechaActualizacion || new Date());
                       if(!isNaN(dt.getTime())) targetPush.push({ d: dt, val: parseFloat(pnt.promedio || pnt.valor || pnt.venta || 0) });
                   });
               } else {
                   let dt2 = new Date(k.fecha || k.fechaActualizacion || new Date());
                   if(!isNaN(dt2.getTime())) targetPush.push({ d: dt2, val: parseFloat(k.promedio || k.valor || k.venta || 0) });
               }
           });
       }

       // Respaldo Mock si la API no provee datos suficientes (Fallback System)
       vGapChartHistory.oficial = (foundValidosOfi.length < 5) ? genMock('bcv') : foundValidosOfi;
       vGapChartHistory.paralelo = (foundValidosPara.length < 5) ? genMock('bin') : foundValidosPara;

       vGapChartHistory.oficial.sort((a,b) => a.d.getTime() - b.d.getTime());
       vGapChartHistory.paralelo.sort((a,b) => a.d.getTime() - b.d.getTime());
       
   } catch(e) {
       vGapChartHistory.oficial = genMock('bcv');
       vGapChartHistory.paralelo = genMock('bin');
   }
}

// Simulador de fluctuaciones (Fallback Architect)
function genMock(originSource) {
   let baseValue = originSource === 'bcv' ? parseFloat(bcvMemoryStack[bcvMemoryStack.length-1])|| 41.0 : parseFloat(binanceMemoryStack[binanceMemoryStack.length-1])||49.5;
   let simulatedBaseArrayObj = []; 
   let hoyBaseRef = new Date();
   let walkerVar = baseValue * 0.94; 
   
   for (let nOffsetT = 30; nOffsetT >= 0; nOffsetT--) {
      let dxTmpIndexPointMap = new Date(hoyBaseRef);
      dxTmpIndexPointMap.setDate(dxTmpIndexPointMap.getDate() - nOffsetT);
      walkerVar = walkerVar + (walkerVar * (Math.random() * 0.012 - 0.003)); 
      simulatedBaseArrayObj.push({ d: dxTmpIndexPointMap, val: walkerVar });
   }
   
   simulatedBaseArrayObj[simulatedBaseArrayObj.length -1].val = baseValue; 
   return simulatedBaseArrayObj;
}

// --- MOTOR GRÁFICO (CANVAS RENDERER) ---
function renderActiveChartGraph() {
   const cvs = getEl('ultraHistoryCanvas');
   if (!cvs || !chartIsExpanded) return;
   
   const themeKey = document.body.getAttribute('data-theme') || 'light';
   const uiRed = '#FF453A'; 
   const uiGreen = '#32D74B';
   
   const rectBound = cvs.parentElement.getBoundingClientRect();
   if(rectBound.width === 0) return;

   const dprScaleFactor = window.devicePixelRatio || 1;
   cvs.width = rectBound.width * dprScaleFactor;
   cvs.height = rectBound.height * dprScaleFactor;
   const ctx = cvs.getContext('2d');
   ctx.scale(dprScaleFactor, dprScaleFactor);
   
   let logicalPixelsW = rectBound.width;
   let logicalPixelsH = rectBound.height;
   
   const historyData = vGapChartHistory[currentGraphType] || [];
   if(historyData.length === 0) return;
   
   const mapRates = historyData.map(v => v.val);
   const absMax = Math.max(...mapRates);
   const absMin = Math.min(...mapRates);
   
   const gapDiff = absMax - absMin === 0 ? 1 : absMax - absMin;
   const pTopPadding = absMax + (gapDiff * 0.20); 
   const pBotPadding = absMin - (gapDiff * 0.20); 

   const startVal = mapRates[0];
   const endVal = mapRates[mapRates.length-1];
   
   const mainColor = endVal >= startVal ? uiGreen : uiRed;
   const gradientColor = mainColor === uiGreen ? 'rgba(50,215,75,0.25)' : 'rgba(255,69,58,0.25)';
   
   const updateLabels = (pointIdx) => {
        let activePoint = historyData[pointIdx];
        getEl('hudDate').innerText = formatChartDateLabel(activePoint.d);
        const hudValueEl = getEl('hudValue');
        hudValueEl.innerText = new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2}).format(activePoint.val) + ' Bs';
        hudValueEl.style.color = activePoint.val >= historyData[Math.max(0, pointIdx - 1)].val ? uiGreen : uiRed;
        
        drawPath(pointIdx);
   }

   function drawPath(focusIndex = null) {
      ctx.clearRect(0,0, logicalPixelsW, logicalPixelsH);
      
      let fillGradient= ctx.createLinearGradient(0, 0, 0, logicalPixelsH);
      fillGradient.addColorStop(0, gradientColor);
      fillGradient.addColorStop(1, "rgba(0,0,0,0)");
      
      const pts = [];
      historyData.forEach((pt, idx, arr) => {
          let cx = (idx / (arr.length - 1)) * logicalPixelsW; 
          let cy = logicalPixelsH - ((pt.val - pBotPadding) / (pTopPadding - pBotPadding) * logicalPixelsH);
          pts.push({x: cx, y: cy, originalIndex: idx});
      });
      
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i = 1; i < pts.length; i++){
          ctx.lineTo(pts[i].x, pts[i].y);
      }
      
      const fillPath = new Path2D(ctx.path || ''); 
      ctx.lineTo(logicalPixelsW, logicalPixelsH);
      ctx.lineTo(0, logicalPixelsH);
      ctx.fillStyle = fillGradient; 
      ctx.fill();

      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = mainColor;
      ctx.moveTo(pts[0].x, pts[0].y);
      for(let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();

      if(focusIndex !== null) {
          const hoveredPt = pts[focusIndex];
          const trackColor = themeKey === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 1; 
          ctx.strokeStyle = trackColor;
          ctx.beginPath();
          ctx.moveTo(hoveredPt.x, 0); 
          ctx.lineTo(hoveredPt.x, logicalPixelsH); 
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

   // Purga de eventos mediante clonación de nodos (Memoria segura en iOS/Android)
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
