/* ===== Utilidades ===== */
async function fetchJSON(url){
  const res = await fetch(url, { cache: "no-store" });
  if(!res.ok) throw new Error("fetch fail " + url);
  return res.json();
}
function fmtMoney(x){ return "$" + Number(x).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2}); }
function fmtPct(x){ return (x>=0?"+":"") + Number(x).toFixed(2) + "%"; }
function pnlClass(v){ return v>=0 ? "sn-pnl-pos" : "sn-pnl-neg"; }

/* ===== Cards SELL ===== */
function sellCard(label, icon, row, area){
  if(!row){
    return `<div class="card sn-card ${area}"><div class="sn-head"><span class="sn-icon">${icon}</span>${label}</div><div class="sn-row sn-muted">— sem registro —</div></div>`;
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
  const byDate = [...rows].sort((a,b)=> new Date(a.Data_Trade)-new Date(b.Data_Trade));
  const ultimo = byDate.at(-1) || null;
  const withPct = rows.filter(r=> r.PnL_Pct!==null && r.PnL_Pct!==undefined);
  const melhor = withPct.length ? withPct.reduce((m,r)=> r.PnL_Pct>m.PnL_Pct? r : m, withPct[0]) : null;
  const pior   = withPct.length ? withPct.reduce((m,r)=> r.PnL_Pct<m.PnL_Pct? r : m, withPct[0]) : null;
  const profit = rows.filter(r=> Number(r.PnL_Abs)>0);
  const ultimo_profit = profit.length ? profit.sort((a,b)=> new Date(a.Data_Trade)-new Date(b.Data_Trade)).at(-1) : null;
  const loss = rows.filter(r=> Number(r.PnL_Abs)<0);
  const ultimo_loss = loss.length ? loss.sort((a,b)=> new Date(a.Data_Trade)-new Date(b.Data_Trade)).at(-1) : null;

  const items = [
    ["Último Trade","🕒",ultimo,"ultimo"],
    ["Melhor Trade","🚀",melhor,"melhor"],
    ["Último Trade com Profit","✅",ultimo_profit,"ultimo_profit"],
    ["Pior Trade","💥",pior,"pior"],
    ["Último Trade com Loss","⛔",ultimo_loss,"ultimo_loss"],
  ];
  const html = '<div class="sn-summary-grid">' + items.map(([l,i,r,a])=> sellCard(l,i,r,a)).join("") + "</div>";
  document.getElementById("sell-cards").innerHTML = html;
}

/* ===== Cards Projeto ===== */
function metric(label, valueHtml){
  return `<div class="metric"><div class="sn-metric-head">${label}</div><div class="sn-metric-value">${valueHtml}</div></div>`;
}
function renderProjectSummaryCards(rows){
  const container = document.getElementById("proj-list");
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
    if(!isTotal && r.dias_uteis != null){
      cards.push(metric("Tempo de Projeto (dias úteis)", (r.dias_uteis ?? 0)));
    }
    cards.push(
      metric("PnL Realizado (USD)", `<span class="${pnlPos?"sn-pos":"sn-neg"}">${fmtMoney(r.pnl_realizado||0)}</span>`),
      metric("PnL Realizado (%)", `<span class="${pnlPctPos?"sn-pos":"sn-neg"}">${fmtPct(r.pnl_realizado_pct||0)}</span>`),
    );

    const grid = `<div class="sn-proj-grid">${cards.join("")}</div>`;
    container.insertAdjacentHTML("beforeend", `<h3>📦 ${proj}</h3>${grid}`);
    if(isTotal) break;
  }
}

/* Obtém data do último commit ou usa fallback local */
async function atualizarBuildTime() {
  const urlApi = "https://api.github.com/repos/rafaelcolombo/swingnotes/commits?path=data&per_page=1";
  const el = document.getElementById("build-ts");

  try {
    const r = await fetch(urlApi, { cache: "no-store" });
    if (!r.ok) throw new Error("GitHub API error");
    const data = await r.json();

    // pega o timestamp do commit mais recente
    const iso = data?.[0]?.commit?.committer?.date;
    if (!iso) throw new Error("No commit date");

    const d = new Date(iso);
    const ts = d.toLocaleString("pt-BR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).replace(",", "");

    el.textContent = ts + " BRT";
  } catch (e) {
    console.warn("Erro ao obter data do commit:", e);

    // fallback: data/hora local
    const now = new Date();
    const tsLocal = now.toLocaleString("pt-BR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).replace(",", "");

    el.textContent = tsLocal + " (local)";
  }
}


  // helper: busca apenas headers (sem baixar o corpo todo)
  async function getLastModified(u){
    const r = await fetch(u, { method: "HEAD", cache: "no-store" });
    if (!r.ok) throw new Error("HEAD fail " + u);
    const lm = r.headers.get("last-modified"); // ex: "Wed, 22 Oct 2025 17:59:56 GMT"
    return lm ? new Date(lm) : null;
  }

  try {
    const results = await Promise.allSettled(urls.map(getLastModified));
    const dates = results
      .map(x => x.status === "fulfilled" ? x.value : null)
      .filter(Boolean);

    if (dates.length === 0) throw new Error("no Last-Modified headers");

    // pega a mais recente
    const last = new Date(Math.max(...dates.map(d => d.getTime())));
    const ts = last.toLocaleString("pt-BR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).replace(",", "");

    document.getElementById("build-ts").textContent = ts + " BRT";
  } catch (e) {
    console.error("Erro ao obter Last-Modified:", e);
    document.getElementById("build-ts").textContent = "—";
  }
}
  

async function boot() {
  await atualizarBuildTime();

  const [sell, proj] = await Promise.all([
    fetchJSON("./data/eventos_sell.json"),
    fetchJSON("./data/resumo_projeto.json")
  ]);

  renderSellSummaryCards(sell);
  renderProjectSummaryCards(proj);
}
boot();

