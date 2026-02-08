// DATABASE.JS - DADOS HISTÓRICOS WFM

// Curva Intraday de Chamadas (08h as 20h - 13 horas)
// Distribuição % do volume diário
const curveSAC = [
    0.04, // 08:00
    0.08, // 09:00
    0.10, // 10:00
    0.09, // 11:00
    0.08, // 12:00
    0.08, // 13:00
    0.08, // 14:00
    0.09, // 15:00
    0.09, // 16:00
    0.10, // 17:00
    0.08, // 18:00
    0.06, // 19:00
    0.03  // 20:00
];

// Dados Históricos Mensais 2025
const db_historico = [
    { mes: 'Jan', yfrank: 217517, cmari: 37455, vol: 13605, cr: 0.05336 },
    { mes: 'Fev', yfrank: 219200, cmari: 37172, vol: 13605, cr: 0.05336 },
    { mes: 'Mar', yfrank: 219845, cmari: 36860, vol: 13605, cr: 0.05307 },
    { mes: 'Abr', yfrank: 220086, cmari: 36618, vol: 13605, cr: 0.05300 },
    { mes: 'Mai', yfrank: 220639, cmari: 36257, vol: 13605, cr: 0.05300 },
    { mes: 'Jun', yfrank: 221955, cmari: 35820, vol: 13605, cr: 0.05296 },
    { mes: 'Jul', yfrank: 260870, cmari: 35277, vol: 13605, cr: 0.05278 },
    { mes: 'Ago', yfrank: 261120, cmari: 34789, vol: 13605, cr: 0.04594 },
    { mes: 'Set', yfrank: 267159, cmari: 34330, vol: 13605, cr: 0.04598 },
    { mes: 'Out', yfrank: 270288, cmari: 33925, vol: 13605, cr: 0.04513 },
    { mes: 'Nov', yfrank: 276870, cmari: 33555, vol: 13605, cr: 0.04472 },
    { mes: 'Dez', yfrank: 287464, cmari: 33114, vol: 13605, cr: 0.04383 }
];