/* ===========================
   Swing Notes — Front
   =========================== */

/* ---------- Utilidades ---------- */
async function fetchJSON(url){
  const bust = (url.includes("?") ? "&" : "?") + "v=" + Date.now();
  const res = await fetch(url + bust, { cache: "no-store" });
  if(!res.ok) throw new Error("fetch fail " + url + " [" + res.status + "]");
  return res.json();
}

function fmtMoney(x){ return "$" + Number(x).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtPct(x){ return (x>=0?"+":"") + Number(x).toFixed(2) + "%"; }
function pnlClass(v){ return v>=0 ? "sn-pnl-pos" : "sn-pnl-neg"; }

function lastFiveMinuteMark(d = new Date()){
  const mins = d.getMinutes();
  const nearest = mins - (mins % 5);
  const dd = new Date(d);
  dd.setMinutes(nearest, 0, 0);
  const hh = String(dd.getHours()).padStart(2,"0");
  const mm = String(dd.getMinutes()).padStart(2,"0");
  return `${hh}:${mm}`;
}

/* ---------- Cards de Totais por Projeto (TOP) ---------- */
async function loadSummary(project){ // "swingnotes" | "countdown"
  return fetchJSON(`./data/abertos_${project}_summary.json`);
}

function renderTopCardsFor(projectName, summary){
  if(!summary) return "";
  const nice = (summary.project === "swingnotes") ? "Swing Notes" : "Countdown";
  const klass = (summary.pnl_total_abs >= 0) ? "sn-pos" : "sn-neg";
  return `
    <div class="sn-card">
      <div class="sn-k">Valor alocado (${nice})</div>
      <div class="sn-v">${fmtMoney(summary.valor_alocado_total)}</div>
    </div>
    <div class="sn-card">
      <div class="sn-k">Valor atual (${nice})</div>
      <div class="sn-v">${fmtMoney(summary.valor_atual_total)}</div>
    </div>
    <div class="sn-card">
      <div class="sn-k">PnL total (${nice})</div>
      <div class="sn-v ${klass}">${fmtMoney(summary.pnl_total_abs)} · ${fmtPct(summary.pnl_total_pct)}</div>
    </div>
  `;
}

async function renderCardsTop(){
  const el = document.getElementById("cards");
  if(!el) return;
  try{
    const [swing, count] = await Promise.all([
      loadSummary("swingnotes").catch(()=>null),
      loadSummary("countdown").catch(()=>null),
    ]);
    el.innerHTML = renderTopCardsFor("swingnotes", swing) + renderTopCardsFor("countdown", count);
  }catch(e){
    console.error("Falha ao renderizar cards de topo", e);
    el.innerHTML = "";
  }
}

/* ---------- RESUMO PORTFÓLIO (4 CARDS) ---------- */
/* Soma todos os projetos existentes (swingnotes, countdown, minimumwage) */
async function renderPortfolioSummary(){
  const ids = ["summary-invested", "summary-current", "summary-pnl-usd", "summary-pnl-pct"];
  if(!ids.every(id => document.getElementById(id))) return;

  const projects = ["swingnotes", "countdown", "minimumwage"];
  let invested = 0, current = 0;

  for(const p of projects){
    try{
      const data = await fetchJSON(`./data/abertos_${p}_summary.json`);
      if(data){
        invested += Number(data.valor_alocado_total || 0);
        current  += Number(data.valor_atual_total || 0);
      }
    }catch{
      console.warn(`Resumo ausente para projeto: ${p}`);
    }
  }

  const pnlUsd = current - invested;
  const pnlPct = invested ? (pnlUsd / invested) * 100 : 0;

  const investedEl = document.getElementById("summary-invested");
  const currentEl  = document.getElementById("summary-current");
  const pnlUsdEl   = document.getElementById("summary-pnl-usd");
  const pnlPctEl   = document.getElementById("summary-pnl-pct");

  investedEl.textContent = fmtMoney(invested);
  currentEl.textContent  = fmtMoney(current);
  pnlUsdEl.textContent   = fmtMoney(pnlUsd);
  pnlPctEl.textContent   = fmtPct(pnlPct);

  pnlUsdEl.className = "sn-summary-value " + (pnlUsd >= 0 ? "pos" : "neg");
  pnlPctEl.className = "sn-summary-value " + (pnlPct >= 0 ? "pos" : "neg");
}


/* ---------- Cards SELL ---------- */
function sellCard(label, icon, row, area){
  if(!row){
    return `<div class="card sn-card ${area}">
      <div class="sn-head"><span class="sn-icon">${icon}</span>${label}</div>
      <div class="sn-row sn-muted">— sem registro —</div>
    </div>`;
  }
  const data = new Date(row.Data_Trade).toISOString().slice(0,10);
  const qty = Number(row.Qtd_Vendida||0).toFixed(8);
  return `<div class="card sn-card ${area}">
    <div class="sn-head"><span class="sn-icon">${icon}</span>${label}</div>
    <div class="sn-row"><span class="sn-chip sn-tkr">${row.Ticker}</span><span class="sn-chip">${data}</span></div>
    <div class="sn-row">PnL: <span class="${pnlClass(row.PnL_Abs)}">${fmtMoney(row.PnL_Abs)}</span>
      <span class="${pnlClass(row.PnL_Abs)}">(${fmtPct(row.PnL_Pct)})</span></div>
    <div class="sn-row sn-muted">Qtd vendida: ${qty}</div>
  </div>`;
}

function renderSellSummaryCards(rows){
  const byDate   = [...rows].sort((a,b)=> new Date(a.Data_Trade)-new Date(b.Data_Trade));
  const ultimo   = byDate.at(-1) || null;
  const withPct  = rows.filter(r=> r.PnL_Pct!==null && r.PnL_Pct!==undefined);
  const melhor   = withPct.length ? withPct.reduce((m,r)=> r.PnL_Pct>m.PnL_Pct? r : m, withPct[0]) : null;
  const pior     = withPct.length ? withPct.reduce((m,r)=> r.PnL_Pct<m.PnL_Pct? r : m, withPct[0]) : null;
  const profit   = rows.filter(r=> Number(r.PnL_Abs)>0);
  const loss     = rows.filter(r=> Number(r.PnL_Abs)<0);
  const ultimo_profit = profit.length ? profit.sort((a,b)=> new Date(a.Data_Trade)-new Date(b.Data_Trade)).at(-1) : null;
  const ultimo_loss   = loss.length   ? loss.sort((a,b)=> new Date(a.Data_Trade)-new Date(b.Data_Trade)).at(-1)   : null;

  const items = [
    ["Último Trade","🕒",ultimo,"ultimo"],
    ["Melhor Trade","🚀",melhor,"melhor"],
    ["Último Trade com Profit","✅",ultimo_profit,"ultimo_profit"],
    ["Pior Trade","💥",pior,"pior"],
    ["Último Trade com Loss","⛔",ultimo_loss,"ultimo_loss"],
  ];
  const html = '<div class="sn-summary-grid">' + items.map(([l,i,r,a])=> sellCard(l,i,r,a)).join("") + "</div>";
  const mount = document.getElementById("sell-cards");
  if(mount) mount.innerHTML = html;
}

/* ---------- Cards Projeto (resumo_projeto.json) ---------- */
function metric(label, valueHtml){
  return `<div class="metric">
    <div class="sn-metric-head">${label}</div>
    <div class="sn-metric-value">${valueHtml}</div>
  </div>`;
}

/* ------ Separa PROJETOS de TOTAIS ------ */
function renderProjectSummaryCards(rows){
  const projContainer  = document.getElementById("proj-list");
  const totalContainer = document.getElementById("total-card"); // nova seção

  if (projContainer) projContainer.innerHTML = "";
  if (totalContainer) totalContainer.innerHTML = "";

  // separa TOTAL dos demais
  const totalRow = rows.find(r => String(r.Project).toUpperCase() === "TOTAL");
  const projects = rows
    .filter(r => String(r.Project).toUpperCase() !== "TOTAL")
    .sort((a,b)=> String(a.Project).localeCompare(String(b.Project)));

  // helper pra montar cards
  const buildCards = (r, isTotal=false) => {
    const pnlPos    = Number(r.pnl_realizado)      >= 0;
    const pnlPctPos = Number(r.pnl_realizado_pct)  >= 0;

    const cards = [
      metric("Capital Inicial", fmtMoney(r.capital_inicial||0)),
      metric("Trades Fechados", (r.trades_fechados_totalmente||0)),
      metric("Trades com Profit", (r.trades_com_profit||0)),
      metric("Trades com Loss", (r.trades_com_loss||0)),
      metric("Trades em Andamento", (r.trades_em_andamento||0)),
    ];

    if (!isTotal && r.dias_uteis != null) {
      cards.push(metric("Tempo de Projeto (dias úteis)", (r.dias_uteis ?? 0)));
    }

    // PnL
    cards.push(
      metric("PnL Realizado (USD)", `<span class="${pnlPos?"sn-pos":"sn-neg"}">${fmtMoney(r.pnl_realizado||0)}</span>`),
      metric("PnL Realizado (%)", `<span class="${pnlPctPos?"sn-pos":"sn-neg"}">${fmtPct(r.pnl_realizado_pct||0)}</span>`),
    );

    // >>> NOVOS CARDS (somente TOTAL)
    if (isTotal && r.meta != null) {
      const metaVal = Number(r.meta);
      const pctRaw = (r.meta_atingido_pct != null)
        ? Number(r.meta_atingido_pct)
        : (metaVal > 0 ? (Number(r.pnl_realizado||0) / metaVal) * 100 : 0);
      const pctPos = pctRaw >= 0;

      cards.push(
        metric("Meta", fmtMoney(metaVal)),
        metric("% Meta Atingido", `<span class="${pctPos ? "sn-pos":"sn-neg"}">${fmtPct(pctRaw)}</span>`),
      );
    }

    return `<div class="sn-proj-grid">${cards.join("")}</div>`;
  };

  if (projContainer){
    for (const r of projects){
      const projName = String(r.Project).toUpperCase();
      projContainer.insertAdjacentHTML("beforeend", `<h3>📦 ${projName}</h3>${buildCards(r,false)}`);
    }
  }

  if (totalContainer && totalRow){
    totalContainer.insertAdjacentHTML("beforeend", buildCards(totalRow,true));
  }
}

/* ===== Helpers barra da Meta ===== */
function fmtMoneyUS(n){
  try { return n.toLocaleString('en-US', {style:'currency', currency:'USD'}); }
  catch { return `$${Number(n||0).toFixed(2)}`; }
}
function parseBRMoney(txt){
  const raw = String(txt||'').replace(/[^\d.,-]/g,'').trim();
  const asEN = raw.replace(/\./g,'').replace(',', '.');
  const v = parseFloat(asEN);
  return isNaN(v) ? 0 : v;
}

/* ===== Render barra ===== */
function renderGoalBar({ target, achieved }){
  const elFill = document.querySelector('#goalbar-fill');
  const elPct  = document.querySelector('#goalbar-pct');
  const elMin  = document.querySelector('#goalbar-min');
  const elMid  = document.querySelector('#goalbar-mid');
  const elMax  = document.querySelector('#goalbar-max');
  if (!elFill) return;

  const T = Math.max(0, Number(target||0));
  const A = Math.max(0, Number(achieved||0));
  const pct = T > 0 ? Math.min(100, (A/T)*100) : 0;

  elFill.style.width = pct.toFixed(2) + '%';
  elPct.textContent  = pct.toFixed(2) + '%';
  elMin.textContent  = '$0';
  elMid.textContent  = fmtMoneyUS(A);
  elMax.textContent  = fmtMoneyUS(T);
}

/* ===== Marcadores 25/50/75% ===== */
function ensureGoalTicks(){
  const track = document.querySelector('.goalbar-track');
  if (!track || track.dataset.ticks === '1') return;

  [25,50,75].forEach(pct => {
    const t = document.createElement('div');
    t.className = 'goalbar-tick';
    t.style.left = pct + '%';

    const lbl = document.createElement('span');
    lbl.textContent = pct + '%';
    t.appendChild(lbl);

    track.appendChild(t);
  });

  track.dataset.ticks = '1';
}

/* ===== Busca robusta no DOM ===== */
function findValueByNearbyLabel(root, labelCandidates){
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
  const norm = s => String(s||'').trim().toLowerCase();
  const isLabelMatch = txt => labelCandidates.some(l => norm(txt) === norm(l));
  const numberRegex = /[$€R\$]?\s*[-+]?(\d{1,3}(\.\d{3})*|\d+)(,\d{2})?/;

  while (walker.nextNode()){
    const el = walker.currentNode;
    if (el.children?.length) {
      const labelEl = [...el.children].find(ch => isLabelMatch(ch.textContent));
      if (labelEl){
        const sibVal = labelEl.parentElement?.querySelector('.value, .kpi-value, .stat-value');
        if (sibVal && numberRegex.test(sibVal.textContent)) return sibVal.textContent;

        const card = labelEl.closest('.card, .metric, .kpi, .stat') || el;
        const candidates = [...card.querySelectorAll('*')].filter(n => numberRegex.test(n.textContent));
        if (candidates.length) return candidates[0].textContent;
      }
    }
    if (isLabelMatch(el.textContent)){
      const parent = el.closest('.card, .metric, .kpi, .stat') || el.parentElement || document;
      const candidates = [...parent.querySelectorAll('*')].filter(n => numberRegex.test(n.textContent));
      if (candidates.length) return candidates[0].textContent;
    }
  }
  return '';
}

function getTotalsContainer(){
  const headers = [...document.querySelectorAll('h2,h3,h4,strong,b,span,div')]
    .filter(n => n.childElementCount===0 && n.textContent.trim().toUpperCase()==='TOTAL');
  if (headers.length){
    return headers[0].closest('.cards, .grid, .totals, .section') || headers[0].parentElement || document;
  }
  return document;
}

function readTotalsAndRender(){
  const root = getTotalsContainer();
  const metaTxt = findValueByNearbyLabel(root, ['Meta','Goal']);
  const pnlTxt  = findValueByNearbyLabel(root, ['PnL Realizado (USD)','PnL Realizado']);

  const gb = document.querySelector('#goalbar');
  const targetAttr   = gb?.getAttribute('data-goal-target');
  const achievedAttr = gb?.getAttribute('data-goal-achieved');

  const target   = targetAttr ? Number(targetAttr) : parseBRMoney(metaTxt);
  const achieved = achievedAttr ? Number(achievedAttr) : parseBRMoney(pnlTxt);

  if (target > 0){
    renderGoalBar({ target, achieved });
    ensureGoalTicks();                // <— adiciona os marcadores aqui
    return true;
  }
  return false;
}

/* ===== Estratégias de inicialização ===== */
document.addEventListener('DOMContentLoaded', () => {
  readTotalsAndRender();
});

const _oldRender = typeof window.render === 'function' ? window.render : null;
if (_oldRender){
  window.render = function(){
    const r = _oldRender.apply(this, arguments);
    readTotalsAndRender();
    return r;
  };
}

const observer = new MutationObserver(() => {
  if (readTotalsAndRender()){ observer.disconnect(); }
});
observer.observe(document.documentElement, { childList:true, subtree:true });

/* ---------- Boot ---------- */
async function boot(){
  try{
    const up = document.getElementById("updated");
    if(up) up.textContent = `Atualizado a cada 5' (${lastFiveMinuteMark()})`;

    const [sell, projRaw] = await Promise.all([
      fetchJSON("./data/eventos_sell.json").catch(()=>[]),
      fetchJSON("./data/resumo_projeto.json").catch(()=>null),
    ]);

    const proj = Array.isArray(projRaw) ? projRaw :
                 (projRaw && Array.isArray(projRaw.rows) ? projRaw.rows : []);

    // Resumos do topo por projeto (opcional, mantém)
    await renderCardsTop();

    // **NOVO**: 4 cards do portfólio (investido/atual/PnL USD/PnL %)
    await renderPortfolioSummary();

    renderSellSummaryCards(sell);

    if (proj && proj.length){
      renderProjectSummaryCards(proj);
    } else {
      console.warn("resumo_projeto.json vazio ou não encontrado");
      const projContainer  = document.getElementById("proj-list");
      const totalContainer = document.getElementById("total-card");
      if (projContainer)  projContainer.innerHTML  = `<div class="sn-muted">Nenhum dado de projeto para exibir.</div>`;
      if (totalContainer) totalContainer.innerHTML = `<div class="sn-muted">Total indisponível.</div>`;
    }
  }catch(e){
    console.error("Boot fail:", e);
    const projContainer  = document.getElementById("proj-list");
    const totalContainer = document.getElementById("total-card");
    if (projContainer)  projContainer.innerHTML  = `<div class="sn-muted">Erro ao carregar projetos.</div>`;
    if (totalContainer) totalContainer.innerHTML = `<div class="sn-muted">Erro ao carregar total.</div>`;
  }
}
boot();
