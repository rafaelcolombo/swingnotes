/* ===========================
   Swing Notes — Front
   =========================== */

/* ---------- Utilidades ---------- */
async function fetchJSON(url){
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error("fetch fail " + url);
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

    cards.push(
      metric("PnL Realizado (USD)", `<span class="${pnlPos?"sn-pos":"sn-neg"}">${fmtMoney(r.pnl_realizado||0)}</span>`),
      metric("PnL Realizado (%)", `<span class="${pnlPctPos?"sn-pos":"sn-neg"}">${fmtPct(r.pnl_realizado_pct||0)}</span>`),
    );

    return `<div class="sn-proj-grid">${cards.join("")}</div>`;
  };

  // renderiza projetos (dentro de PROJETOS)
  if (projContainer){
    for (const r of projects){
      const projName = String(r.Project).toUpperCase();
      projContainer.insertAdjacentHTML("beforeend", `<h3>📦 ${projName}</h3>${buildCards(r,false)}`);
    }
  }

  // renderiza TOTAL (fora, na seção própria)
  if (totalContainer && totalRow){
    // seção "TOTAL" já tem <h2>TOTAL</h2> no HTML; aqui só os cards
    totalContainer.insertAdjacentHTML("beforeend", buildCards(totalRow,true));
  }
}

/*function renderProjectSummaryCards(rows){
  const container = document.getElementById("proj-list");
  if(!container) return;
  const sorted = [...rows].sort((a,b)=> (a.Project==="TOTAL") - (b.Project==="TOTAL") || a.Project.localeCompare(b.Project));
  container.innerHTML = "";

  for(const r of sorted){
    const proj = String(r.Project).toUpperCase();
    const isTotal = proj === "TOTAL";
    const pnlPos = Number(r.pnl_realizado)>=0;
    const pnlPctPos = Number(r.pnl_realizado_pct)>=0;

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

    cards.push(
      metric("PnL Realizado (USD)", `<span class="${pnlPos?"sn-pos":"sn-neg"}">${fmtMoney(r.pnl_realizado||0)}</span>`),
      metric("PnL Realizado (%)", `<span class="${pnlPctPos?"sn-pos":"sn-neg"}">${fmtPct(r.pnl_realizado_pct||0)}</span>`),
    );

    const grid = `<div class="sn-proj-grid">${cards.join("")}</div>`;
    container.insertAdjacentHTML("beforeend", `<h3>📦 ${proj}</h3>${grid}`);
    if (isTotal) break;
  }
}

/* ---------- Boot ---------- */
async function boot(){
  try{
    // Atualiza legenda "Atualizado a cada 5' (HH:MM)"
    const up = document.getElementById("updated");
    if(up) up.textContent = `Atualizado a cada 5' (${lastFiveMinuteMark()})`;

    // Carrega e renderiza:
    const [sell, proj] = await Promise.all([
      fetchJSON("./data/eventos_sell.json").catch(()=>[]),
      fetchJSON("./data/resumo_projeto.json").catch(()=>[]),
    ]);

    await renderCardsTop();              // <<< novos cards de topo (swingnotes + countdown)
    renderSellSummaryCards(sell);        // cards de SELL
    renderProjectSummaryCards(proj);     // cards de resumo por projeto
  }catch(e){
    console.error("Boot fail:", e);
  }
}
boot();
