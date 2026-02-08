// Configuração Global
Chart.defaults.color = '#ccc';
Chart.defaults.borderColor = '#333';
let charts = {}; 

window.onload = function() {
    console.log("Sistema WFM Gap Analysis Iniciado.");
    initCharts();
    calculateAndRender();
    document.getElementById('btnCalc').addEventListener('click', calculateAndRender);
};

// --- ERLANG C MATH ---
function factorial(n) {
    if (n === 0 || n === 1) return 1;
    let r = 1;
    for (let i = 2; i <= n; i++) r *= i;
    return r;
}

function calculateErlangC(traffic, agents) {
    let powerTraffic = Math.pow(traffic, agents) / factorial(agents);
    let sum = 0;
    for (let i = 0; i < agents; i++) sum += Math.pow(traffic, i) / factorial(i);
    return powerTraffic / (sum + (powerTraffic * (agents / (agents - traffic))));
}

function getRequiredAgents(traffic, slTarget, targetTime, aht, maxOcc) {
    if (traffic <= 0) return { agents: 0, occupancy: 0 };
    let agents = Math.ceil(traffic) + 1;
    while (true) {
        let occ = traffic / agents;
        if (occ > maxOcc) { agents++; continue; }
        
        let pWait = calculateErlangC(traffic, agents);
        let serviceLevel = 1 - (pWait * Math.exp(-(agents - traffic) * (targetTime / aht)));
        
        if (serviceLevel >= slTarget) return { agents: agents, occupancy: occ };
        agents++;
        if (agents > traffic * 10 && agents > 5) return { agents: agents, occupancy: 0 }; 
    }
}

function initCharts() {
    // 1. GAP Analysis (HC Atual vs Necessário)
    const ctxPos = document.getElementById('chartPositions').getContext('2d');
    charts.positions = new Chart(ctxPos, {
        type: 'line',
        data: {
            labels: db_historico.map(d => d.mes),
            datasets: [
                {
                    label: 'HC Atual (Fixo)',
                    borderColor: '#f5a623', // Laranja
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    data: [] 
                },
                {
                    label: 'HC Necessário (Erlang)',
                    borderColor: '#d94fd9', // Roxo
                    backgroundColor: 'rgba(217, 79, 217, 0.1)',
                    borderWidth: 3,
                    tension: 0.3,
                    fill: true,
                    data: [] 
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, labels: { color: '#fff' } } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // 2. Barras (Unificado)
    const ctxVol = document.getElementById('chartVolume').getContext('2d');
    charts.volume = new Chart(ctxVol, {
        type: 'bar',
        data: {
            labels: db_historico.map(d => d.mes),
            datasets: [
                { label: 'Volume Base', backgroundColor: '#5b76f2', data: [] },
                { label: 'BID', backgroundColor: '#2fa86d', data: [] }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { x: { stacked: true }, y: { stacked: true } }
        }
    });

    // 3. Pizza
    const ctxTMA = document.getElementById('chartTMA').getContext('2d');
    charts.tma = new Chart(ctxTMA, {
        type: 'doughnut',
        data: {
            labels: ['Produtivo', 'Shrinkage', 'Absenteísmo', 'Ociosidade'],
            datasets: [{
                data: [],
                backgroundColor: ['#2fa86d', '#f5a623', '#d94fd9', '#333'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { boxWidth: 10, color: '#fff' } } }
        }
    });
}

function calculateAndRender() {
    // INPUTS
    const currentHc = parseFloat(document.getElementById('currentHcInput').value) || 0;
    
    const bidVolTotalAno = parseFloat(document.getElementById('inputBidVol').value) || 0;
    const bidMonthlyGrowth = (parseFloat(document.getElementById('inputGrowthBid').value) || 0) / 100;
    const growthCarteira = (parseFloat(document.getElementById('inputGrowthCarteira').value) || 0) / 100;
    
    // WFM
    const tmaInput = parseFloat(document.getElementById('tmeInput').value) || 350;
    const slTarget = (parseFloat(document.getElementById('slInput').value) || 80) / 100;
    const targetTime = parseFloat(document.getElementById('targetTimeInput').value) || 20;
    const maxOccupancy = (parseFloat(document.getElementById('occupancyInput').value) || 85) / 100;
    
    const contractHours = parseFloat(document.getElementById('contractHoursInput').value) || 180;
    const shrinkage = (parseFloat(document.getElementById('shrinkageInput').value) || 0) / 100;
    const absenteeism = (parseFloat(document.getElementById('absenteeismInput').value) || 0) / 100;
    const totalShrinkage = shrinkage + absenteeism;
    
    const cost = parseFloat(document.getElementById('costInput').value) || 0;
    
    const rosteringSafety = 1.15; 

    // FINANCEIRO BID
    let baseBidMonth0 = 0;
    const n = 12;
    if (bidVolTotalAno > 0) {
        if (bidMonthlyGrowth <= 0) baseBidMonth0 = bidVolTotalAno / n;
        else baseBidMonth0 = (bidVolTotalAno * bidMonthlyGrowth) / (Math.pow(1 + bidMonthlyGrowth, n) - 1);
    }

    // LOOP
    let dataBase = [];
    let dataBid = [];
    let dataReqHC = [];
    let dataCurrentHC = [];
    
    let totalReqHC = 0;
    let totalPas = 0;
    let globalRealOcc = 0;

    db_historico.forEach((mesData, index) => {
        // Volume
        let volBidMes = baseBidMonth0 * Math.pow(1 + bidMonthlyGrowth, index);
        let totalCli = mesData.yfrank + mesData.cmari;
        let cr = mesData.cr || (totalCli > 0 ? mesData.vol / totalCli : 0);
        let cliProj = totalCli * (1 + growthCarteira);
        let volBaseProj = cliProj * cr;
        
        let totalVolMes = volBaseProj + volBidMes;
        let finalVolSac = totalVolMes * 0.27;
        let finalVolAjuda = totalVolMes * 0.73;

        dataBase.push(Math.round(volBaseProj));
        dataBid.push(Math.round(volBidMes));
        
        // Linha fixa do HC Atual
        dataCurrentHC.push(currentHc);

        // Erlang
        let diasUteis = 22;
        let volDiaSac = finalVolSac / diasUteis;
        let volDiaVoz = finalVolAjuda / diasUteis;
        let horasLogadasDia = 0;

        for(let h=0; h<13; h++) {
            // SAC
            let callsSac = volDiaSac * curveSAC[h];
            let trafficSac = (callsSac * tmaInput) / 3600;
            let reqSac = getRequiredAgents(trafficSac, slTarget, targetTime, tmaInput, maxOccupancy);

            // Voz
            let curveVozVal = (h === 0) ? 0 : [0.09, 0.11, 0.10, 0.08, 0.08, 0.08, 0.10, 0.11, 0.11, 0.08, 0.06, 0.00][h-1] || 0;
            let callsVoz = volDiaVoz * curveVozVal;
            let trafficVoz = (callsVoz * tmaInput) / 3600;
            let reqVoz = getRequiredAgents(trafficVoz, slTarget, targetTime, tmaInput, maxOccupancy);

            horasLogadasDia += (reqSac.agents + reqVoz.agents);
        }

        // HC Mensal
        let horasLogadasMes = horasLogadasDia * diasUteis;
        let horasReaisNecessarias = horasLogadasMes * rosteringSafety;
        let horasLiquidasAgente = contractHours * (1 - totalShrinkage);
        let hcMensal = horasReaisNecessarias / horasLiquidasAgente;
        
        dataReqHC.push(hcMensal);
        totalReqHC += hcMensal;
        totalPas += (horasLogadasDia / 13);
        
        let workloadMes = (totalVolMes * tmaInput) / 3600;
        let occMes = (horasLogadasMes > 0) ? workloadMes / horasLogadasMes : 0;
        globalRealOcc += occMes;
    });

    // RESULTADOS
    let avgReqHC = Math.ceil(totalReqHC / 12);
    let avgPas = Math.ceil(totalPas / 12);
    let avgOcc = globalRealOcc / 12;
    
    // Cálculo do GAP
    let gap = Math.round(avgReqHC - currentHc);
    let costGap = gap * cost;
    
    // Cores dinâmicas para o GAP
    let gapColor = gap > 0 ? "#e74c3c" : "#2fa86d"; // Vermelho se falta gente, Verde se sobra
    let gapText = gap > 0 ? `Faltam ${gap} (Contratar)` : `Sobram ${Math.abs(gap)} (Ociosidade)`;

    document.getElementById('resCurrentHC').innerText = currentHc;
    document.getElementById('resRequiredHC').innerText = avgReqHC;
    
    const elGap = document.getElementById('resGap');
    elGap.innerText = gapText;
    elGap.style.color = gapColor;

    const elCostGap = document.getElementById('resCostGap');
    elCostGap.innerText = costGap.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    elCostGap.style.color = gapColor;

    let rosteringLoss = (1 - (1/rosteringSafety));
    updateCharts(dataBase, dataBid, dataCurrentHC, dataReqHC, avgOcc, shrinkage, absenteeism, rosteringLoss);
}

function updateCharts(base, bid, currentHC, reqHC, occ, shrink, abs, rosteringLoss) {
    if(charts.volume) {
        charts.volume.data.datasets[0].data = base;
        charts.volume.data.datasets[1].data = bid;
        charts.volume.update();
    }
    
    if(charts.positions) {
        charts.positions.data.datasets[0].data = currentHC;
        charts.positions.data.datasets[1].data = reqHC;
        charts.positions.update();
    }

    if(charts.tma) {
        let totalLoss = shrink + abs;
        let operational = 1 - (totalLoss + rosteringLoss);
        charts.tma.data.datasets[0].data = [operational * 100, rosteringLoss * 100, totalLoss * 100, 0];
        charts.tma.update();
    }
}