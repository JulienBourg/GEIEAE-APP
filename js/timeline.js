// ═══════════════════════════════════════════════════════════════
// TIMELINE
// ═══════════════════════════════════════════════════════════════
let tlView = 'week';
let tlStartDate = null;

function tlInit() {
  if (!tlStartDate) {
    const d = getMonday(new Date());
    tlStartDate = fmtISO(addDays(d, -28));
  }
  document.getElementById('tlBtnSem').className  = tlView === 'week'  ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
  document.getElementById('tlBtnMois').className = tlView === 'month' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
}

function tlSetView(v) {
  tlView = v;
  document.getElementById('tlBtnSem').className  = v === 'week'  ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
  document.getElementById('tlBtnMois').className = v === 'month' ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm';
  renderTimeline();
}

function tlNav(dir) {
  if (!tlStartDate) tlInit();
  const d = new Date(tlStartDate + 'T00:00:00');
  if (tlView === 'week') d.setDate(d.getDate() + dir * 12 * 7);
  else d.setMonth(d.getMonth() + dir * 6);
  tlStartDate = fmtISO(d);
  renderTimeline();
}

function tlToday() {
  const d = tlView === 'week' ? getMonday(new Date()) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  tlStartDate = fmtISO(addDays(d, tlView === 'week' ? -28 : 0));
  renderTimeline();
}

function tlGetCols(startISO) {
  const cols = [];
  const d = new Date(startISO + 'T00:00:00');
  if (tlView === 'week') {
    for (let i = 0; i < 52; i++) {
      const mon = getMonday(d);
      const ven = addDays(mon, 6);
      cols.push({ label: 'S' + getWeekNum(mon), subLabel: fmtDisp(fmtISO(mon)), dateDebut: fmtISO(mon), dateFin: fmtISO(ven), key: fmtISO(mon) });
      d.setDate(d.getDate() + 7);
    }
  } else {
    const cur = new Date(d.getFullYear(), d.getMonth(), 1);
    for (let i = 0; i < 24; i++) {
      const fin = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      cols.push({ label: MONTHS_FR[cur.getMonth()] + ' ' + cur.getFullYear(), subLabel: '', dateDebut: fmtISO(new Date(cur)), dateFin: fmtISO(fin), key: fmtISO(new Date(cur)) });
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  return cols;
}

function tlProjectRange(proj) {
  const taches = ganttTaches.filter(t => t.projetId === proj.id);
  let dates = [];
  taches.forEach(t => { if (t.dateDebut) dates.push(t.dateDebut); if (t.dateFin) dates.push(t.dateFin); });
  heuresProjets.filter(h => { const l = lignesProjets.find(l => l.id === h.ligneId); return l && l.projetId === proj.id; }).forEach(h => { if (h.date) dates.push(h.date); });
  if (proj.DateDebut) dates.push(proj.DateDebut);
  if (proj.DateFin)   dates.push(proj.DateFin);
  if (dates.length === 0) return null;
  dates.sort();
  return { debut: dates[0], fin: dates[dates.length - 1] };
}

function tlCalcHours(proj, col) {
  let total = 0;
  heuresProjets.forEach(h => {
    if (!h.date || h.date < col.dateDebut || h.date > col.dateFin) return;
    const l = lignesProjets.find(l => l.id === h.ligneId);
    if (l && l.projetId === proj.id) total += (parseFloat(h.heures) || 0);
  });
  return total;
}

function renderTimeline() {
  tlInit();
  const fEnt  = document.getElementById('tlFilterEnt').value;
  const fType = document.getElementById('tlFilterType').value;
  const projFiltered = projets.filter(p => {
    if (fEnt  && p.Entite !== fEnt)  return false;
    if (fType && p.Type   !== fType) return false;
    return true;
  });
  const cols = tlGetCols(tlStartDate);
  document.getElementById('tlRangeLabel').textContent = cols[0].dateDebut + ' → ' + cols[cols.length - 1].dateFin + ' · ' + cols.length + (tlView === 'week' ? ' semaines' : ' mois');

  const W = { nom: 200, type: 60, resp: 100, cli: 110 };
  const TOTAL_FIXED = W.nom + W.type + W.resp + W.cli;
  const COL_W = tlView === 'week' ? 40 : 80;

  document.getElementById('tlFixed').style.width = TOTAL_FIXED + 'px';

  const thF = (w) => `background:var(--navy);color:#fff;font-size:10px;font-weight:600;padding:4px 8px;border:1px solid rgba(255,255,255,.15);white-space:nowrap;text-align:left;width:${w}px;min-width:${w}px;max-width:${w}px;position:sticky;top:0;z-index:10`;
  const thS = `background:var(--navy);color:#fff;font-size:10px;font-weight:600;padding:3px 4px;border:1px solid rgba(255,255,255,.15);white-space:nowrap;text-align:center;width:${COL_W}px;min-width:${COL_W}px;position:sticky;top:0;z-index:10`;
  const thSMonth = `background:var(--navy-dark);color:#fff;font-size:10px;font-weight:600;padding:3px 6px;border:1px solid rgba(255,255,255,.15);white-space:nowrap;text-align:center;position:sticky;top:0;z-index:10`;
  const tdF = (w, extra) => `background:#fff;font-size:11px;padding:4px 8px;border:1px solid var(--grey-200);vertical-align:middle;width:${w}px;min-width:${w}px;max-width:${w}px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap${extra?';'+extra:''}`;
  const tdCell = `font-size:10px;padding:2px 3px;border:1px solid var(--grey-200);text-align:center;vertical-align:middle;width:${COL_W}px;min-width:${COL_W}px`;
  const posteColors = { LA:'#1a3a5c', LS:'#1a7a4a', CONV:'#f07800', Mixte:'#7c3aed', Autre:'#64748b' };
  const rowBgA = '#fff', rowBgB = '#f7f9fb';

  // Table fixe header
  const fHRow = `<tr>
    <th style="${thF(W.nom)}">Projet</th>
    <th style="${thF(W.type)}">Type</th>
    <th style="${thF(W.resp)}">Responsable</th>
    <th style="${thF(W.cli)}">Client</th>
  </tr>`;

  // Table scroll header
  let sHRows = '';
  if (tlView === 'week') {
    const monthMap = {};
    cols.forEach(c => { const mo = new Date(c.dateDebut + 'T00:00:00'); const key = mo.getFullYear() + '-' + mo.getMonth(); monthMap[key] = (monthMap[key] || 0) + 1; });
    let mRow = '<tr>';
    Object.entries(monthMap).forEach(([k, n]) => { const [y, m] = k.split('-'); mRow += `<th colspan="${n}" style="${thSMonth}">${MONTHS_FR[parseInt(m)]} ${y}</th>`; });
    sHRows += mRow + '</tr>';
  }
  let sColRow = '<tr>';
  cols.forEach(c => { sColRow += `<th style="${thS}"><div>${c.label}</div>${c.subLabel ? `<div style="font-weight:400;opacity:.75;font-size:9px">${c.subLabel}</div>` : ''}</th>`; });
  sHRows += sColRow + '</tr>';

  let fixedBody = '', scrollBody = '';
  const today = fmtISO(new Date());

  if (projFiltered.length === 0) {
    fixedBody  = `<tr><td colspan="4" style="text-align:center;padding:32px;color:var(--grey-500)">Aucun projet</td></tr>`;
    scrollBody = `<tr><td colspan="${cols.length}" style="padding:32px"></td></tr>`;
  } else {
    projFiltered.forEach((p, pi) => {
      const rowBg = pi % 2 === 0 ? rowBgA : rowBgB;
      const catColor = posteColors[p.Type] || '#64748b';
      const range = tlProjectRange(p);
      fixedBody += `<tr style="height:32px">
        <td style="${tdF(W.nom, 'font-weight:600;color:var(--navy)')};background:${rowBg}" title="${(p.Nom||'').replace(/"/g,'')}">${p.Nom||'—'}</td>
        <td style="${tdF(W.type)};font-weight:700;color:${catColor};background:${rowBg}">${p.Type||'—'}</td>
        <td style="${tdF(W.resp)};background:${rowBg}" title="${p.Responsable||''}">${p.Responsable||'—'}</td>
        <td style="${tdF(W.cli)};background:${rowBg}" title="${p.Client||''}">${p.Client||'—'}</td>
      </tr>`;
      scrollBody += '<tr style="height:32px">';
      cols.forEach(c => {
        const inRange = range && range.debut <= c.dateFin && range.fin >= c.dateDebut;
        const isStart = range && range.debut >= c.dateDebut && range.debut <= c.dateFin;
        const isEnd   = range && range.fin   >= c.dateDebut && range.fin   <= c.dateFin;
        const isToday = today >= c.dateDebut && today <= c.dateFin;
        const hours   = inRange ? tlCalcHours(p, c) : 0;
        let cellBg = rowBg, cellContent = '', extraStyle = '';
        if (inRange) {
          cellBg = catColor + '28';
          if (hours > 0) cellContent = `<span style="font-size:9px;font-weight:700;color:${catColor};font-family:'DM Mono',monospace">${hours % 1 === 0 ? hours : hours.toFixed(1)}h</span>`;
          if (isStart && isEnd) extraStyle = 'border-radius:6px';
          else if (isStart)     extraStyle = 'border-radius:6px 0 0 6px';
          else if (isEnd)       extraStyle = 'border-radius:0 6px 6px 0';
        }
        scrollBody += `<td style="${tdCell};background:${cellBg}${extraStyle ? ';' + extraStyle : ''}">${cellContent}</td>`;
      });
      scrollBody += '</tr>';
    });
  }

  const tblF = document.getElementById('tlTableFixed');
  const tblS = document.getElementById('tlTableScroll');
  tblF.innerHTML = `<colgroup><col style="width:${W.nom}px"><col style="width:${W.type}px"><col style="width:${W.resp}px"><col style="width:${W.cli}px"></colgroup><thead>${fHRow}</thead><tbody>${fixedBody}</tbody>`;
  tblS.innerHTML = `<thead>${sHRows}</thead><tbody>${scrollBody}</tbody>`;

  // Sync scroll vertical
  const scrollEl = document.getElementById('tlScroll');
  const fixedEl  = document.getElementById('tlFixed');
  if (scrollEl._tlSync) scrollEl.removeEventListener('scroll', scrollEl._tlSync);
  scrollEl._tlSync = () => { fixedEl.scrollTop = scrollEl.scrollTop; };
  scrollEl.addEventListener('scroll', scrollEl._tlSync);

  // Sync hauteurs body rows
  requestAnimationFrame(() => {
    const rowsF = tblF.querySelectorAll('tbody tr');
    const rowsS = tblS.querySelectorAll('tbody tr');
    const len = Math.min(rowsF.length, rowsS.length);
    for (let i = 0; i < len; i++) {
      const h = Math.max(rowsF[i].getBoundingClientRect().height, rowsS[i].getBoundingClientRect().height, 32);
      rowsF[i].style.height = h + 'px';
      rowsS[i].style.height = h + 'px';
    }
    // Sync header : table fixe = 1 ligne, table scroll = 1 ou 2 lignes (mois + cols)
    // On force la ligne unique du header fixe à avoir la hauteur totale du header scroll
    const hdrF = tblF.querySelector('thead');
    const hdrS = tblS.querySelector('thead');
    if (hdrF && hdrS) {
      const totalH = hdrS.getBoundingClientRect().height;
      const fRow = hdrF.querySelector('tr');
      if (fRow) fRow.style.height = totalH + 'px';
    }
  });
}
