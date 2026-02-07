// Configuração de cores globais do Chart.js para combinar com o tema
Chart.defaults.color = '#ccc';
Chart.defaults.borderColor = '#333';

let charts = {}; // Variável para armazenar os gráficos e poder atualizá-los

document.addEventListener('DOMContentLoaded', () => {
    // 1. Inicia os gráficos vazios ou com dados padrão
    initCharts();
    
    // 2. Realiza o cálculo inicial ao carregar a página
    calculateAndRender();

    // 3. Adiciona evento de clique no botão "CALCULAR"
    document.getElementById('btnCalc').addEventListener('click', calculateAndRender);
});

function calculateAndRender() {
    // --- COLETA DE DADOS DO HTML ---
    const volumeMensal = parseFloat(document.getElementById('volumeInput').value) || 0;
    const tme = parseFloat(document.getElementById('tmeInput').value) || 0;
    const occupancyTarget = (parseFloat(document.getElementById('occupancyInput').value) || 100) / 100;
    const costPerPA = parseFloat(document.getElementById('costInput').value) || 0;
    
    // --- LÓGICA DE CAPACITY (Simplificada) ---
    
    // Premissa: Mês de 22 dias úteis
    const diasUteis = 22;
    const volumeDiario = volumeMensal / diasUteis;
    
    // Premissa: Hora de Pico concentra 15% do volume do dia
    const volumeHoraPico = volumeDiario * 0.15;
    
    // Intensidade de Tráfego (Erlangs) = (Chamadas/hora * TME seg) / 3600
    const erlangs = (volumeHoraPico * tme) / 3600;

    // Cálculo de PAs necessárias (Erlang Simples + Ocupação)
    let requiredPas = erlangs / occupancyTarget;
    
    // Shrinkage (Perdas operacionais: absenteísmo, pausas) - Adotado 20%
    const shrinkage = 1.20; 
    
    // Arredondamentos
    const pasLogadas = Math.ceil(requiredPas); // PAs no momento de pico
    const headcount = Math.ceil(pasLogadas * shrinkage); // Pessoas contratadas
    const totalCost = headcount * costPerPA;

    // --- ATUALIZAÇÃO DOS RESULTADOS NA TELA ---
    document.getElementById('resPas').innerText = pasLogadas;
    document.getElementById('resHeadcount').innerText = headcount;
    document.getElementById('resTotalCost').innerText = totalCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    // --- ATUALIZAÇÃO DOS GRÁFICOS ---
    updateCharts(pasLogadas, volumeMensal, tme);
}

function initCharts() {
    // Gráfico 1: Linha (Intraday)
    const ctxPos = document.getElementById('chartPositions').getContext('2d');
    charts.positions = new Chart(ctxPos, {
        type: 'line',
        data: {
            labels: ['08:00', '10:00', '12:00', '14:00', '16:00', '18:00', '20:00'],
            datasets: [{
                label: 'Posições Necessárias',
                borderColor: '#a64ca6', // Roxo
                backgroundColor: 'rgba(166, 76, 166, 0.2)',
                borderWidth: 2,
                tension: 0.4, // Curva suave
                fill: true,
                data: [] 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Gráfico 2: Barras (Volume Semanal)
    const ctxVol = document.getElementById('chartVolume').getContext('2d');
    charts.volume = new Chart(ctxVol, {
        type: 'bar',
        data: {
            labels: ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'],
            datasets: [{
                label: 'Chamadas',
                backgroundColor: '#d94fd9', // Roxo Neon
                data: []
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });

    // Gráfico 3: Pizza (TME)
    const ctxTme = document.getElementById('chartTME').getContext('2d');
    charts.tme = new Chart(ctxTme, {
        type: 'doughnut',
        data: {
            labels: ['Falado', 'Em Espera', 'Pós-atendimento'],
            datasets: [{
                data: [],
                backgroundColor: ['#a64ca6', '#5b76f2', '#f5a623'], // Cores do tema
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { position: 'right', labels: { boxWidth: 10, color: '#fff' } } 
            }
        }
    });
}

function updateCharts(agentes, volume, tme) {
    // Simulação de distribuição dos dados calculados
    
    // 1. Atualiza Curva Intraday
    // Cria um padrão de curva de atendimento e multiplica pelos agentes calculados
    const padraoCurva = [0.5, 0.8, 1.0, 0.9, 0.7, 0.6, 0.3]; 
    charts.positions.data.datasets[0].data = padraoCurva.map(f => Math.ceil(f * agentes));
    charts.positions.update();

    // 2. Atualiza Volume Semanal
    const mediaSemanal = volume / 4;
    charts.volume.data.datasets[0].data = [
        mediaSemanal * 0.9, 
        mediaSemanal * 1.1, 
        mediaSemanal * 1.05, 
        mediaSemanal * 0.95
    ];
    charts.volume.update();

    // 3. Atualiza TME (Falado vs Espera vs ACW)
    // Distribuição estimada: 70% Falado, 10% Espera, 20% ACW
    charts.tme.data.datasets[0].data = [
        tme * 0.70, 
        tme * 0.10, 
        tme * 0.20
    ];
    charts.tme.update();
}