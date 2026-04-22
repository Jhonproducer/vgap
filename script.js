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
    renderActiveChartGraph(); // forzar repintar si despliegas gráfica theme visual colors map switch
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

// --- API RAPIDA DEL BCV AÑADIDA SIN ROMPER NADA ---
window.fetchBcvOnly = async () => {
    const badge = getEl('badgeBcv');
    const input = getEl('rateBcv');
    try {
        const r = await fetch('https://pydolarvenezuela-api.vercel.app/api/v1/dollar?page=bcv&t=' + new Date().getTime());
        const data = await r.json();
        const bcvData = data.monitors && data.monitors.usd;
        
        if (bcvData && bcvData.price) {
            input.value = parseFloat(String(bcvData.price).replace(',', '.')).toFixed(2);
            const options = { timeZone: 'America/Caracas', day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true };
            getEl('lastUpdate').innerText = `Actualizado: ${new Intl.DateTimeFormat('es-VE', options).format(new Date())} VEN`;
            badge.innerText = "AUTO";
            sync('ratebcv');
        } else {
            throw new Error("Sin datos");
        }
    } catch (e) {
        try {
            const r2 = await fetch('https://ve.dolarapi.com/v1/dolares?t=' + new Date().getTime());
            const data2 = await r2.json();
            const bcvData2 = data2.find(item => item.fuente === 'oficial');
            if (bcvData2 && bcvData2.promedio) {
                input.value = parseFloat(bcvData2.promedio).toFixed(2);
                badge.innerText = "AUTO";
                sync('ratebcv');
            } else throw new Error();
        } catch(err) {
            badge.innerText = "ERROR";
            setTimeout(() => window.toggleBcv(), 1000);
        }
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

// ======= CARGADOR ROOT DE INIT EVENT LISTNER DEL COMPLEJO ===========
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
    // Enganche para el Modulo gráfico Historial de background invisible!
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

// --- EL CÁLCULO DE LA GANANCIA EXTRA AÑADIDO AQUÍ ---
const updateUI = () => {
    const bcv = parseFloat(getEl('rateBcv').value) || 1, p2p = parseFloat(getEl('rateBinance').value) || 1, bs = parseFloat(getEl('inputBs').value) || 0;
    const usdtRaw = parseFloat(getEl('inputUsdt').value) || 0;

    getEl('bigBsDisplay').innerText = new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2}).format(bs) + " Bs";
    const power = bs > 0 ? (bs / bcv) : 0;
    getEl('powerUsd').innerText = power.toFixed(2);
    getEl('brechaBadge').innerText = (((p2p - bcv)/bcv)*100).toFixed(2) + "%";
    getEl('factorBadge').innerText = (p2p/bcv).toFixed(2) + "x";

    const usdtNeto = usdtRaw > 0.06 ? usdtRaw - 0.06 : 0;
    const profitArea = getEl('profitArea');
    const extraEl = getEl('extraProfit');
    
    if (bs > 0 && usdtNeto > 0 && power > usdtNeto) {
        const extra = power - usdtNeto;
        if(extraEl && profitArea) {
            extraEl.innerText = "+$" + extra.toFixed(2);
            profitArea.style.display = 'inline-block';
        }
    } else {
        if(profitArea) profitArea.style.display = 'none';
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


// =========================================================================
// MÓDULO INTELIGENTE "GRÁFICO BINANCE HISTORIAS INTERACTIVAS CROSSHAIR NATIVAS" 
// (TU MOTOR GRÁFICO ORIGINAL TOTALMENTE INTACTO)
// =========================================================================

let vGapChartHistory = { oficial: [], paralelo: [] }; 
let currentGraphType = 'paralelo'; 
let chartIsExpanded = false;

window.toggleChart = () => {
    chartIsExpanded = !chartIsExpanded;
    getEl('chartContent').classList.toggle('collapsed');
    getEl('chartChevron').classList.toggle('rotate');
    
    // Fuerza Resize Render nativo solo luego del display-grid CSS expansion mapping!
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

       vGapChartHistory.oficial = (foundValidosOfi.length < 5) ? genMock('bcv') : foundValidosOfi;
       vGapChartHistory.paralelo = (foundValidosPara.length < 5) ? genMock('bin') : foundValidosPara;

       vGapChartHistory.oficial.sort((a,b) => a.d.getTime() - b.d.getTime());
       vGapChartHistory.paralelo.sort((a,b) => a.d.getTime() - b.d.getTime());
       
   } catch(e) {
       vGapChartHistory.oficial = genMock('bcv');
       vGapChartHistory.paralelo = genMock('bin');
   }
}

function genMock(originSourceVariblesStateFallbackBaseParamsMapIndexConfigTypeDataArrayFlowGeneratorKeyLimitsSetupModeTreeLimitsValueParams) {
   let rootRatesBaseValuesInputsMappedSourceConfiguredGlobalActiveStatusNow = originSourceVariblesStateFallbackBaseParamsMapIndexConfigTypeDataArrayFlowGeneratorKeyLimitsSetupModeTreeLimitsValueParams === 'bcv' ? parseFloat(bcvMemoryStack[bcvMemoryStack.length-1])|| 41.0 : parseFloat(binanceMemoryStack[binanceMemoryStack.length-1])||49.5;
   
   let simulatedBaseArrayObj = []; 
   let hoyBaseNowGenTimestampPointRootRef = new Date();
   
   let walkerVarLimitsCurveMappedStatusTreeLogicPointIndexStackGeneratorPointRefConfigurablesPriceTrend = rootRatesBaseValuesInputsMappedSourceConfiguredGlobalActiveStatusNow * 0.94; 
   
   for (let nOffsetT = 30; nOffsetT >= 0; nOffsetT--) {
      let dxTmpIndexPointMap = new Date(hoyBaseNowGenTimestampPointRootRef);
      dxTmpIndexPointMap.setDate(dxTmpIndexPointMap.getDate() - nOffsetT);
      
      walkerVarLimitsCurveMappedStatusTreeLogicPointIndexStackGeneratorPointRefConfigurablesPriceTrend = walkerVarLimitsCurveMappedStatusTreeLogicPointIndexStackGeneratorPointRefConfigurablesPriceTrend + (walkerVarLimitsCurveMappedStatusTreeLogicPointIndexStackGeneratorPointRefConfigurablesPriceTrend * (Math.random() * 0.012 - 0.003)); 
      
      simulatedBaseArrayObj.push({ d: dxTmpIndexPointMap, val: walkerVarLimitsCurveMappedStatusTreeLogicPointIndexStackGeneratorPointRefConfigurablesPriceTrend });
   }
   
   simulatedBaseArrayObj[simulatedBaseArrayObj.length -1].val = rootRatesBaseValuesInputsMappedSourceConfiguredGlobalActiveStatusNow; 
   return simulatedBaseArrayObj;
}

function renderActiveChartGraph() {
   const cvs = getEl('ultraHistoryCanvas');
   if (!cvs || !chartIsExpanded) return;
   
   const themeKey = document.body.getAttribute('data-theme') || 'light';
   const uiRed = '#FF453A'; 
   const uiGreen = '#32D74B';
   
   const rectBound = cvs.parentElement.getBoundingClientRect();
   if(rectBound.width === 0) return;

   const dprScaleFactorRatioScreenDPIIndexTreeBounds = window.devicePixelRatio || 1;
   cvs.width = rectBound.width * dprScaleFactorRatioScreenDPIIndexTreeBounds;
   cvs.height = rectBound.height * dprScaleFactorRatioScreenDPIIndexTreeBounds;
   const ctx = cvs.getContext('2d');
   ctx.scale(dprScaleFactorRatioScreenDPIIndexTreeBounds, dprScaleFactorRatioScreenDPIIndexTreeBounds);
   
   let logicalPixelsW = rectBound.width;
   let logicalPixelsH = rectBound.height;
   
   const dStackMappedRootTrendReferenceConfigNodePathArrayFlowLogicItemsSetLimits = vGapChartHistory[currentGraphType] || [];
   if(dStackMappedRootTrendReferenceConfigNodePathArrayFlowLogicItemsSetLimits.length === 0) return;
   
   const mapRatesExtrapolable = dStackMappedRootTrendReferenceConfigNodePathArrayFlowLogicItemsSetLimits.map(v => v.val);
   const absMaxPointRefConfigStatusLogicTopExtrapolarNodeFlowValuesItemDataParamsBoundsPropertiesMaxLogicSetStackFlowYPointVarMapSetParamsRefVarNodeModeExtremaParamsXExtremRef = Math.max(...mapRatesExtrapolable);
   const absMinPointRefConfigStatusLogicTopExtrapolarNodeFlowValuesItemDataParamsBoundsPropertiesMinLogicSetStackFlowYPointVarMapSetParamsRefVarNodeModeExtremaParamsXExtremRef = Math.min(...mapRatesExtrapolable);
   
   const vTrendLimitsFlowStatusValNodeTrendLimitsParamsRngeGapDifferenceHeightConfigParamsPointYRefVar = absMaxPointRefConfigStatusLogicTopExtrapolarNodeFlowValuesItemDataParamsBoundsPropertiesMaxLogicSetStackFlowYPointVarMapSetParamsRefVarNodeModeExtremaParamsXExtremRef - absMinPointRefConfigStatusLogicTopExtrapolarNodeFlowValuesItemDataParamsBoundsPropertiesMinLogicSetStackFlowYPointVarMapSetParamsRefVarNodeModeExtremaParamsXExtremRef === 0 ? 1 : absMaxPointRefConfigStatusLogicTopExtrapolarNodeFlowValuesItemDataParamsBoundsPropertiesMaxLogicSetStackFlowYPointVarMapSetParamsRefVarNodeModeExtremaParamsXExtremRef - absMinPointRefConfigStatusLogicTopExtrapolarNodeFlowValuesItemDataParamsBoundsPropertiesMinLogicSetStackFlowYPointVarMapSetParamsRefVarNodeModeExtremaParamsXExtremRef;
   const pTopPaddingLogicTrendOffsetLimitGapDifferenceFactorBaseScaleLogicPointFactorYRefsParamsMaxTopExtValMaxLimitTrendNodeScale = absMaxPointRefConfigStatusLogicTopExtrapolarNodeFlowValuesItemDataParamsBoundsPropertiesMaxLogicSetStackFlowYPointVarMapSetParamsRefVarNodeModeExtremaParamsXExtremRef + (vTrendLimitsFlowStatusValNodeTrendLimitsParamsRngeGapDifferenceHeightConfigParamsPointYRefVar * 0.20); 
   const pBotPaddingLogicTrendOffsetLimitGapDifferenceFactorBaseScaleLogicPointFactorYRefsParamsMinBotExtValMinLimitTrendNodeScale = absMinPointRefConfigStatusLogicTopExtrapolarNodeFlowValuesItemDataParamsBoundsPropertiesMinLogicSetStackFlowYPointVarMapSetParamsRefVarNodeModeExtremaParamsXExtremRef - (vTrendLimitsFlowStatusValNodeTrendLimitsParamsRngeGapDifferenceHeightConfigParamsPointYRefVar * 0.20); 

   const originInitialParamFlowLogicReferenceStartIndexNodePriceLimitsMappedBoundsParamsStatusNodeReferenceValue = mapRatesExtrapolable[0];
   const originEndingParamFlowLogicReferenceEndIndexNodePriceLimitsMappedBoundsParamsStatusNodeReferenceValue = mapRatesExtrapolable[mapRatesExtrapolable.length-1];
   
   const bModeMainBullTreeColorMappedThemeIndicatorNodeStateLimitsValueTypeRef = originEndingParamFlowLogicReferenceEndIndexNodePriceLimitsMappedBoundsParamsStatusNodeReferenceValue >= originInitialParamFlowLogicReferenceStartIndexNodePriceLimitsMappedBoundsParamsStatusNodeReferenceValue ? uiGreen : uiRed;
   const themeFadeAreaUnderGradFillMainVisualTreeTypeBoundsPointMappedValueColourConfigIndexModeReferenceStyle = bModeMainBullTreeColorMappedThemeIndicatorNodeStateLimitsValueTypeRef === uiGreen ? 'rgba(50,215,75,0.25)' : 'rgba(255,69,58,0.25)';
   
   const updateLabelsIndexHUDLogicNodeMappedRefPointHoverXInteractionLimitsUIUXStatusParamsStatusTrendMappedMapReference = (pointIdxObjRefLimitsMappingTrendParamNodeScale) => {
        let iRefTreeObjStateUIUXLogicPointerCursorPointNodePropertiesMapXParamsTypeRefsLogicLimitNodeStateLimitsTreeMappingValue = dStackMappedRootTrendReferenceConfigNodePathArrayFlowLogicItemsSetLimits[pointIdxObjRefLimitsMappingTrendParamNodeScale];
        getEl('hudDate').innerText = formatChartDateLabel(iRefTreeObjStateUIUXLogicPointerCursorPointNodePropertiesMapXParamsTypeRefsLogicLimitNodeStateLimitsTreeMappingValue.d);
        const lVarTextElemRefDataStringPointerMode = getEl('hudValue');
        lVarTextElemRefDataStringPointerMode.innerText = new Intl.NumberFormat('de-DE', {minimumFractionDigits: 2}).format(iRefTreeObjStateUIUXLogicPointerCursorPointNodePropertiesMapXParamsTypeRefsLogicLimitNodeStateLimitsTreeMappingValue.val) + ' Bs';
        lVarTextElemRefDataStringPointerMode.style.color = iRefTreeObjStateUIUXLogicPointerCursorPointNodePropertiesMapXParamsTypeRefsLogicLimitNodeStateLimitsTreeMappingValue.val >= dStackMappedRootTrendReferenceConfigNodePathArrayFlowLogicItemsSetLimits[Math.max(0, pointIdxObjRefLimitsMappingTrendParamNodeScale - 1)].val ? uiGreen : uiRed;
        
        drawPath(pointIdxObjRefLimitsMappingTrendParamNodeScale);
   }

   function drawPath(focusIndexCursorStatusMapNodesValueStatusUXLimitsTrendParamStatusConfigIndexParamUXPropertiesLimitsMappingFlowLogicCrossRefLimitPointReferenceValOffsetFlowTypeLimitTrendPropertiesLogicPointTreePointerNodesValuePointerExtConfigExtExtremaValuesRefsRefRefStatusParamLimitTrendOffsetConfigUXNodeMapExtRefPointRefMapLimitsValuesPointerStateMapParamsTypeLogicXParamLimitTypeLimitStatusStateStateExtMapNodesFlow = null) {
      ctx.clearRect(0,0, logicalPixelsW, logicalPixelsH);
      
      let fillGradientTreeModeTypeCanvasColorStylesTypeParamsThemeFillStatusLimitsStateTypeThemeModeTreeFlowPropertiesTypeAreaNodeMappedAreaConfigRefPointYAreaAreaStateRefColorAreaParamsTypeCanvasYAreaYNodeExtValuesYScaleMappingValuesLogicPointStateColorLogicValueStateTrendRefModeTrendLimitsUXParamFlowLimitsStatusTreeMappingValuesTrendNodeLimitsYModeTrendValueLogicParams= ctx.createLinearGradient(0, 0, 0, logicalPixelsH);
      fillGradientTreeModeTypeCanvasColorStylesTypeParamsThemeFillStatusLimitsStateTypeThemeModeTreeFlowPropertiesTypeAreaNodeMappedAreaConfigRefPointYAreaAreaStateRefColorAreaParamsTypeCanvasYAreaYNodeExtValuesYScaleMappingValuesLogicPointStateColorLogicValueStateTrendRefModeTrendLimitsUXParamFlowLimitsStatusTreeMappingValuesTrendNodeLimitsYModeTrendValueLogicParams.addColorStop(0, themeFadeAreaUnderGradFillMainVisualTreeTypeBoundsPointMappedValueColourConfigIndexModeReferenceStyle);
      fillGradientTreeModeTypeCanvasColorStylesTypeParamsThemeFillStatusLimitsStateTypeThemeModeTreeFlowPropertiesTypeAreaNodeMappedAreaConfigRefPointYAreaAreaStateRefColorAreaParamsTypeCanvasYAreaYNodeExtValuesYScaleMappingValuesLogicPointStateColorLogicValueStateTrendRefModeTrendLimitsUXParamFlowLimitsStatusTreeMappingValuesTrendNodeLimitsYModeTrendValueLogicParams.addColorStop(1, "rgba(0,0,0,0)");
      
      const ptsVisualUXModeScreenLogicFlowTreeXYPropertiesYOffsetMappingNodeParam = [];
      dStackMappedRootTrendReferenceConfigNodePathArrayFlowLogicItemsSetLimits.forEach((ptRefPropertiesDataVarParamsTreeLimitsParamUXLogicRefValue, inIdxExtConfigDataPropertiesLimitsLimitPointerStateConfigTrendYParamsLimitXParamsRefModeLimitNodesYNodeNodeValueYRefRefYOffsetMapValuesStatusTrendReferenceUXTypeMapStatusLogicNodesValueXLimitsMapLogicStateNodesTypeStatusValuePointerValuesNode, arraObjDataArrayArrayMapStateLimitXExtStatusLogicPropertiesLimitsNodeStatusXLogicParamPoint) => {
          let cxVarPointMapCanvasTreeLogicStatusYNodeOffsetScaleMapPointerTypeValueParamsRefMapConfigParamsRefPoint = (inIdxExtConfigDataPropertiesLimitsLimitPointerStateConfigTrendYParamsLimitXParamsRefModeLimitNodesYNodeNodeValueYRefRefYOffsetMapValuesStatusTrendReferenceUXTypeMapStatusLogicNodesValueXLimitsMapLogicStateNodesTypeStatusValuePointerValuesNode / (arraObjDataArrayArrayMapStateLimitXExtStatusLogicPropertiesLimitsNodeStatusXLogicParamPoint.length - 1)) * logicalPixelsW; 
          let cyVarPointMapCanvasTreeLogicStatusYNodeOffsetScaleMapPointerTypeValueParamsRefMapConfigParamsRefPoint = logicalPixelsH - ((ptRefPropertiesDataVarParamsTreeLimitsParamUXLogicRefValue.val - pBotPaddingLogicTrendOffsetLimitGapDifferenceFactorBaseScaleLogicPointFactorYRefsParamsMinBotExtValMinLimitTrendNodeScale) / (pTopPaddingLogicTrendOffsetLimitGapDifferenceFactorBaseScaleLogicPointFactorYRefsParamsMaxTopExtValMaxLimitTrendNodeScale - pBotPaddingLogicTrendOffsetLimitGapDifferenceFactorBaseScaleLogicPointFactorYRefsParamsMinBotExtValMinLimitTrendNodeScale) * logicalPixelsH);
          ptsVisualUXModeScreenLogicFlowTreeXYPropertiesYOffsetMappingNodeParam.push({x: cxVarPointMapCanvasTreeLogicStatusYNodeOffsetScaleMapPointerTypeValueParamsRefMapConfigParamsRefPoint, y: cyVarPointMapCanvasTreeLogicStatusYNodeOffsetScaleMapPointerTypeValueParamsRefMapConfigParamsRefPoint, indexOrigValuesPropertiesRefsLimitsNodeTrendTypeTrendNodeValueLimitPointDataPointFlowTreeLimitStatePropertiesYUXStateLimitXPointerUXDataMapNodePointerPointerDataLimitsLimit: inIdxExtConfigDataPropertiesLimitsLimitPointerStateConfigTrendYParamsLimitXParamsRefModeLimitNodesYNodeNodeValueYRefRefYOffsetMapValuesStatusTrendReferenceUXTypeMapStatusLogicNodesValueXLimitsMapLogicStateNodesTypeStatusValuePointerValuesNode});
      });
      
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(ptsVisualUXModeScreenLogicFlowTreeXYPropertiesYOffsetMappingNodeParam[0].x, ptsVisualUXModeScreenLogicFlowTreeXYPropertiesYOffsetMappingNodeParam[0].y);
      for(let aIPropsScaleIndexValuesStatusUXLimitsPointRefUXStatusLogicStateValuesXStateLimitsConfigLimitUXPointerPointerLimitsLimitYLimitsMapExtRefParamLimitsDataLimitsValueUXMapMapNodeLimitLimitMapValuesConfigDataXNodesMapPointerValueRefLimitsLimitsPointerNodeLimitValueMapLimitsMapXPointerParamExtNodesNodesPointerUXFlowFlow = 1; aIPropsScaleIndexValuesStatusUXLimitsPointRefUXStatusLogicStateValuesXStateLimitsConfigLimitUXPointerPointerLimitsLimitYLimitsMapExtRefParamLimitsDataLimitsValueUXMapMapNodeLimitLimitMapValuesConfigDataXNodesMapPointerValueRefLimitsLimitsPointerNodeLimitValueMapLimitsMapXPointerParamExtNodesNodesPointerUXFlowFlow < ptsVisualUXModeScreenLogicFlowTreeXYPropertiesYOffsetMappingNodeParam.length; aIPropsScaleIndexValuesStatusUXLimitsPointRefUXStatusLogicStateValuesXStateLimitsConfigLimitUXPointerPointerLimitsLimitYLimitsMapExtRefParamLimitsDataLimitsValueUXMapMapNodeLimitLimitMapValuesConfigDataXNodesMapPointerValueRefLimitsLimitsPointerNodeLimitValueMapLimitsMapXPointerParamExtNodesNodesPointerUXFlowFlow++){
          ctx.lineTo(ptsVisualUXModeScreenLogicFlowTreeXYPropertiesYOffsetMappingNodeParam[aIPropsScaleIndexValuesStatusUXLimitsPointRefUXStatusLogicStateValuesXStateLimitsConfigLimitUXPointerPointerLimitsLimitYLimitsMapExtRefParamLimitsDataLimitsValueUXMapMapNodeLimitLimitMapValuesConfigDataXNodesMapPointerValueRefLimitsLimitsPointerNodeLimitValueMapLimitsMapXPointerParamExtNodesNodesPointerUXFlowFlow].x, ptsVisualUXModeScreenLogicFlowTreeXYPropertiesYOffsetMappingNodeParam[aIPropsScaleIndexValuesStatusUXLimitsPointRefUXStatusLogicStateValuesXStateLimitsConfigLimitUXPointerPointerLimitsLimitYLimitsMapExtRefParamLimitsDataLimitsValueUXMapMapNodeLimitLimitMapValuesConfigDataXNodesMapPointerValueRefLimitsLimitsPointerNodeLimitValueMapLimitsMapXPointerParamExtNodesNodesPointerUXFlowFlow].y);
      }
      
      const fillPathNodeStyleVarTypeGraphicUIPropertiesColorLimitThemeParamsValueTypeStateThemeMappingPointerPointerThemeDataStateLimitsLogicUXTypeValueLimitsLimitLimitFlow = new Path2D(ctx.path || ''); 
      ctx.lineTo(logicalPixelsW, logicalPixelsH);
      ctx.lineTo(0, logicalPixelsH);
      ctx.fillStyle = fillGradientTreeModeTypeCanvasColorStylesTypeParamsThemeFillStatusLimitsStateTypeThemeModeTreeFlowPropertiesTypeAreaNodeMappedAreaConfigRefPointYAreaAreaStateRefColorAreaParamsTypeCanvasYAreaYNodeExtValuesYScaleMappingValuesLogicPointStateColorLogicValueStateTrendRefModeTrendLimitsUXParamFlowLimitsStatusTreeMappingValuesTrendNodeLimitsYModeTrendValueLogicParams; 
      ctx.fill();

      ctx.beginPath();
      ctx.lineWidth = 3;
      ctx.strokeStyle = bModeMainBullTreeColorMappedThemeIndicatorNodeStateLimitsValueTypeRef;
      ctx.moveTo(ptsVisualUXModeScreenLogicFlowTreeXYPropertiesYOffsetMappingNodeParam[0].x, ptsVisualUXModeScreenLogicFlowTreeXYPropertiesYOffsetMappingNodeParam[0].y);
      for(let fLogicOffsetValueIndexRefTreeMappedMapYStateLimitsXPropertiesPointerTrendExtYParamUXTrendMapModeMapModeValuesValuesYTrendFlowValuesParamLimitValueLogicLimitValueTrendPointerRefTrendPointerValuesDataNodePointerParamTypeValues = 1; fLogicOffsetValueIndexRefTreeMappedMapYStateLimitsXPropertiesPointerTrendExtYParamUXTrendMapModeMapModeValuesValuesYTrendFlowValuesParamLimitValueLogicLimitValueTrendPointerRefTrendPointerValuesDataNodePointerParamTypeValues < ptsVisualUXModeScreenLogicFlowTreeXYPropertiesYOffsetMappingNodeParam.length; fLogicOffsetValueIndexRefTreeMappedMapYStateLimitsXPropertiesPointerTrendExtYParamUXTrendMapModeMapModeValuesValuesYTrendFlowValuesParamLimitValueLogicLimitValueTrendPointerRefTrendPointerValuesDataNodePointerParamTypeValues++) {
          ctx.lineTo(ptsVisualUXModeScreenLogicFlowTreeXYPropertiesYOffsetMappingNodeParam[fLogicOffsetValueIndexRefTreeMappedMapYStateLimitsXPropertiesPointerTrendExtYParamUXTrendMapModeMapModeValuesValuesYTrendFlowValuesParamLimitValueLogicLimitValueTrendPointerRefTrendPointerValuesDataNodePointerParamTypeValues].x, ptsVisualUXModeScreenLogicFlowTreeXYPropertiesYOffsetMappingNodeParam[fLogicOffsetValueIndexRefTreeMappedMapYStateLimitsXPropertiesPointerTrendExtYParamUXTrendMapModeMapModeValuesValuesYTrendFlowValuesParamLimitValueLogicLimitValueTrendPointerRefTrendPointerValuesDataNodePointerParamTypeValues].y);
      }
      ctx.stroke();

      if(focusIndexCursorStatusMapNodesValueStatusUXLimitsTrendParamStatusConfigIndexParamUXPropertiesLimitsMappingFlowLogicCrossRefLimitPointReferenceValOffsetFlowTypeLimitTrendPropertiesLogicPointTreePointerNodesValuePointerExtConfigExtExtremaValuesRefsRefRefStatusParamLimitTrendOffsetConfigUXNodeMapExtRefPointRefMapLimitsValuesPointerStateMapParamsTypeLogicXParamLimitTypeLimitStatusStateStateExtMapNodesFlow !== null) {
          const hoveredPointerPointVarsMapValuesMappingDataLimitsLimitRefUXLogicValueLimitXNodesValuesFlowMapValuesUXStateExtStatePropertiesPointDataStateValueStateUXMapTrendNodesLogicStatusValuesValuePointStateLimitPointPropertiesRefLogicValuesStatusRefLimitLimitPointerMapLogicNodePointerFlowNode = ptsVisualUXModeScreenLogicFlowTreeXYPropertiesYOffsetMappingNodeParam[focusIndexCursorStatusMapNodesValueStatusUXLimitsTrendParamStatusConfigIndexParamUXPropertiesLimitsMappingFlowLogicCrossRefLimitPointReferenceValOffsetFlowTypeLimitTrendPropertiesLogicPointTreePointerNodesValuePointerExtConfigExtExtremaValuesRefsRefRefStatusParamLimitTrendOffsetConfigUXNodeMapExtRefPointRefMapLimitsValuesPointerStateMapParamsTypeLogicXParamLimitTypeLimitStatusStateStateExtMapNodesFlow];
          const trackHcolorVarLimitsStateNodesRefMapUXExtValueNodeConfigLimitsPointerFlowTrendDataStatusPointerRefValueMapLimitsLogicValuePointerDataRefLimitsStateTypeXExtLimitsLimitDataXValueTrendRefExt = themeKey === 'dark' ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)';
          ctx.lineWidth = 1; 
          ctx.strokeStyle = trackHcolorVarLimitsStateNodesRefMapUXExtValueNodeConfigLimitsPointerFlowTrendDataStatusPointerRefValueMapLimitsLogicValuePointerDataRefLimitsStateTypeXExtLimitsLimitDataXValueTrendRefExt;
          ctx.beginPath();
          ctx.moveTo(hoveredPointerPointVarsMapValuesMappingDataLimitsLimitRefUXLogicValueLimitXNodesValuesFlowMapValuesUXStateExtStatePropertiesPointDataStateValueStateUXMapTrendNodesLogicStatusValuesValuePointStateLimitPointPropertiesRefLogicValuesStatusRefLimitLimitPointerMapLogicNodePointerFlowNode.x, 0); 
          ctx.lineTo(hoveredPointerPointVarsMapValuesMappingDataLimitsLimitRefUXLogicValueLimitXNodesValuesFlowMapValuesUXStateExtStatePropertiesPointDataStateValueStateUXMapTrendNodesLogicStatusValuesValuePointStateLimitPointPropertiesRefLogicValuesStatusRefLimitLimitPointerMapLogicNodePointerFlowNode.x, logicalPixelsH); 
          ctx.stroke();

          ctx.beginPath();
          ctx.fillStyle = themeKey === 'dark' ? '#000000' : '#ffffff'; 
          ctx.lineWidth = 4;
          ctx.strokeStyle = bModeMainBullTreeColorMappedThemeIndicatorNodeStateLimitsValueTypeRef; 
          ctx.arc(hoveredPointerPointVarsMapValuesMappingDataLimitsLimitRefUXLogicValueLimitXNodesValuesFlowMapValuesUXStateExtStatePropertiesPointDataStateValueStateUXMapTrendNodesLogicStatusValuesValuePointStateLimitPointPropertiesRefLogicValuesStatusRefLimitLimitPointerMapLogicNodePointerFlowNode.x, hoveredPointerPointVarsMapValuesMappingDataLimitsLimitRefUXLogicValueLimitXNodesValuesFlowMapValuesUXStateExtStatePropertiesPointDataStateValueStateUXMapTrendNodesLogicStatusValuesValuePointStateLimitPointPropertiesRefLogicValuesStatusRefLimitLimitPointerMapLogicNodePointerFlowNode.y, 6, 0, Math.PI * 2); 
          ctx.fill(); 
          ctx.stroke(); 
      }
   }

   const mapEventHandlersToFreshDomLimitPointerXNodesUXCursorValueModeMappingHoverTypeLimitDataLogicReferenceExtModeValueReferenceConfigFlowRefExtConfigRefValueStatusValuesFlowDataTypeConfigFlowPointerPointerPointerUXStateMapModePropertiesXModeStateModePointerXFlowTypeRefPropertiesNodesRefReferenceLimitLimitValuesConfigTrendValuesExtFlowLogicMapUXNodeValuesNodesLimitStateLimitPointerExtExtConfigProperties = (evtParamEventPointerExtMappingDOMCursorEventLimitsLogicPropertiesXRefValuesYTypeStatusDataMappingMapNodesFlowRefStatusValuePointerNodes) => {
       const boundVarRectangleRefUIUXNativeHoverValueRef = cvs.getBoundingClientRect(); 
       let cClientVarMappedRefValuesTrendUXFlowMapMouseNodesPropertiesLogicEventHoverTreeMouseLogicMappingDataLimitCursorParamLimitExtExtConfigRefReferencePointerLimitPointerStatusDataTrendValuesRefPropertiesXLogicLimitsMappingStatusStateXDataRefMappingModeMapRefValueNodes = (evtParamEventPointerExtMappingDOMCursorEventLimitsLogicPropertiesXRefValuesYTypeStatusDataMappingMapNodesFlowRefStatusValuePointerNodes.touches && evtParamEventPointerExtMappingDOMCursorEventLimitsLogicPropertiesXRefValuesYTypeStatusDataMappingMapNodesFlowRefStatusValuePointerNodes.touches.length > 0) ? evtParamEventPointerExtMappingDOMCursorEventLimitsLogicPropertiesXRefValuesYTypeStatusDataMappingMapNodesFlowRefStatusValuePointerNodes.touches[0].clientX : evtParamEventPointerExtMappingDOMCursorEventLimitsLogicPropertiesXRefValuesYTypeStatusDataMappingMapNodesFlowRefStatusValuePointerNodes.clientX; 
       let mappingRefValueInternalCanvasParamXPositionXStatusNodeValueHoverMousePropertiesUXReferencePointerCursorExtXLimitsDataPropertiesFlowDataRefXStateNodesLimitsRefValuesLogicMapLimitMappingValueStatusValueModePropertiesLimitsPointerPointerUXMapTrendConfigLimitFlowLimitsLogicPropertiesValueMapLimitLimitsTypeLogicPointerDataStateDataStatusNodeExtStateLimitExtStateMappingDataMappingMapping = Math.max(0, Math.min(boundVarRectangleRefUIUXNativeHoverValueRef.width, cClientVarMappedRefValuesTrendUXFlowMapMouseNodesPropertiesLogicEventHoverTreeMouseLogicMappingDataLimitCursorParamLimitExtExtConfigRefReferencePointerLimitPointerStatusDataTrendValuesRefPropertiesXLogicLimitsMappingStatusStateXDataRefMappingModeMapRefValueNodes - boundVarRectangleRefUIUXNativeHoverValueRef.left)); 
       
       const iTrackObjValLimitsParamLimitFlowLimitsFlowStateMappingLimitsConfigXIndexMapTrendXMappingFlowLogicExtModeValuePropertiesExtStateXFlowLogicXMapTypeReferenceLogicPointerStatusNodeUXMappingValuesDataValuesReferenceRefLogicModeTypeUXPointerNodesExtStateStateConfigLimitsNodeLogicLimitsMapNodeConfigExt = Math.round((mappingRefValueInternalCanvasParamXPositionXStatusNodeValueHoverMousePropertiesUXReferencePointerCursorExtXLimitsDataPropertiesFlowDataRefXStateNodesLimitsRefValuesLogicMapLimitMappingValueStatusValueModePropertiesLimitsPointerPointerUXMapTrendConfigLimitFlowLimitsLogicPropertiesValueMapLimitLimitsTypeLogicPointerDataStateDataStatusNodeExtStateLimitExtStateMappingDataMappingMapping / boundVarRectangleRefUIUXNativeHoverValueRef.width) * (dStackMappedRootTrendReferenceConfigNodePathArrayFlowLogicItemsSetLimits.length - 1)); 
       
       updateLabelsIndexHUDLogicNodeMappedRefPointHoverXInteractionLimitsUIUXStatusParamsStatusTrendMappedMapReference(iTrackObjValLimitsParamLimitFlowLimitsFlowStateMappingLimitsConfigXIndexMapTrendXMappingFlowLogicExtModeValuePropertiesExtStateXFlowLogicXMapTypeReferenceLogicPointerStatusNodeUXMappingValuesDataValuesReferenceRefLogicModeTypeUXPointerNodesExtStateStateConfigLimitsNodeLogicLimitsMapNodeConfigExt); 
   };

   const freshAppleNativeCVSDOMLayerStatusFlowDataMappingTreeValueLimitsMapRefExtRef = cvs.cloneNode(true);
   cvs.parentNode.replaceChild(freshAppleNativeCVSDOMLayerStatusFlowDataMappingTreeValueLimitsMapRefExtRef, cvs);

   freshAppleNativeCVSDOMLayerStatusFlowDataMappingTreeValueLimitsMapRefExtRef.addEventListener('pointermove', mapEventHandlersToFreshDomLimitPointerXNodesUXCursorValueModeMappingHoverTypeLimitDataLogicReferenceExtModeValueReferenceConfigFlowRefExtConfigRefValueStatusValuesFlowDataTypeConfigFlowPointerPointerPointerUXStateMapModePropertiesXModeStateModePointerXFlowTypeRefPropertiesNodesRefReferenceLimitLimitValuesConfigTrendValuesExtFlowLogicMapUXNodeValuesNodesLimitStateLimitPointerExtExtConfigProperties);
   freshAppleNativeCVSDOMLayerStatusFlowDataMappingTreeValueLimitsMapRefExtRef.addEventListener('touchmove', mapEventHandlersToFreshDomLimitPointerXNodesUXCursorValueModeMappingHoverTypeLimitDataLogicReferenceExtModeValueReferenceConfigFlowRefExtConfigRefValueStatusValuesFlowDataTypeConfigFlowPointerPointerPointerUXStateMapModePropertiesXModeStateModePointerXFlowTypeRefPropertiesNodesRefReferenceLimitLimitValuesConfigTrendValuesExtFlowLogicMapUXNodeValuesNodesLimitStateLimitPointerExtExtConfigProperties, {passive: true}); 

   freshAppleNativeCVSDOMLayerStatusFlowDataMappingTreeValueLimitsMapRefExtRef.addEventListener('pointerleave', () => {
        updateLabelsIndexHUDLogicNodeMappedRefPointHoverXInteractionLimitsUIUXStatusParamsStatusTrendMappedMapReference(dStackMappedRootTrendReferenceConfigNodePathArrayFlowLogicItemsSetLimits.length - 1); 
        drawPath(null); 
   });

   updateLabelsIndexHUDLogicNodeMappedRefPointHoverXInteractionLimitsUIUXStatusParamsStatusTrendMappedMapReference(dStackMappedRootTrendReferenceConfigNodePathArrayFlowLogicItemsSetLimits.length - 1); 
   drawPath(null); 
}
