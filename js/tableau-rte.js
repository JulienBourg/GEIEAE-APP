// ═══════════════════════════════════════════════════════════════
// TABLEAU RTE
// ═══════════════════════════════════════════════════════════════
const RTE_POSTES = ['LA','LS','CONV'];

function rteInit() {
  const el = document.getElementById('rteStart');
  if (el && !el.value) el.value = fmtISO(getMonday(new Date()));
}

let rteCurrentTab = 1;

function rteShowTab(n) {
  rteCurrentTab = n;
  const t1 = document.getElementById('rteTab1');
  const t2 = document.getElementById('rteTab2');
  t1.style.fontWeight = n===1 ? '600' : '400';
  t1.style.color = n===1 ? 'var(--navy)' : 'var(--grey-600)';
  t1.style.borderBottom = n===1 ? '3px solid var(--navy)' : '3px solid transparent';
  t2.style.fontWeight = n===2 ? '600' : '400';
  t2.style.color = n===2 ? 'var(--navy)' : 'var(--grey-600)';
  t2.style.borderBottom = n===2 ? '3px solid var(--navy)' : '3px solid transparent';
  document.getElementById('rtePanel1').style.display = n===1 ? '' : 'none';
  document.getElementById('rtePanel2').style.display = n===2 ? '' : 'none';
  rteRefresh();
}

function rteRefresh() {
  if (rteCurrentTab === 1) renderRTE();
  else renderRTECap();
}

function rteGetWeeks(startDate, n) {
  const weeks = [];
  let cur = getMonday(new Date(startDate + 'T00:00:00'));
  for (let i = 0; i < n; i++) {
    const wEnd = addDays(cur, 6);
    weeks.push({
      label: 'S' + getWeekNum(cur),
      labelDate: cur.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}),
      dateDebut: fmtISO(cur),
      dateFin:   fmtISO(wEnd),
      year: cur.getFullYear()
    });
    cur = addDays(cur, 7);
  }
  return weeks;
}

// Calcule l'ETP d'un poste donné sur un projet pour une semaine
// ETP = heures planifiées / (5 jours * 8h) capped to 1 per person
function rteETP(projetId, poste, week) {
  // Ressources du poste planifiées sur ce projet
  const lignes = lignesProjets.filter(l => l.projetId === projetId);
  let totalH = 0;
  for (let d = 0; d < 5; d++) {
    const ds = fmtISO(addDays(new Date(week.dateDebut + 'T00:00:00'), d));
    lignes.forEach(l => {
      const rsc = ressources.find(r => rscName(r) === l.ressource);
      if (!rsc || rsc.Poste !== poste) return;
      const h = heuresProjets.find(x => x.ligneId === l.id && x.date === ds);
      if (h) totalH += h.heures;
    });
  }
  const etp = totalH / 40; // 40h = 1 ETP semaine
  return etp > 0 ? Math.round(etp * 10) / 10 : 0;
}

function renderRTE() {
  const RTE_N_WEEKS = 52;
  const startVal = document.getElementById('rteStart').value;
  const startDate = startVal || fmtISO(new Date());
  const weeks = rteGetWeeks(startDate, RTE_N_WEEKS);

  document.getElementById('rteInfo').textContent =
    weeks[0].dateDebut + ' → ' + weeks[weeks.length-1].dateFin + ' · ' + RTE_N_WEEKS + ' semaines';

  const tblF = document.getElementById('rteTableFixed');
  const tblS = document.getElementById('rteTableScroll');

  // Largeurs fixes — immuables
  const W = { eotp:80, lot:50, nom:188, cli:110, fiab:90, cat:46 };
  const TOTAL_FIXED = W.eotp + W.lot + W.nom + W.cli + W.fiab + W.cat; // 526px

  // Appliquer la largeur fixe au conteneur gauche
  document.getElementById('rteFixed').style.width = TOTAL_FIXED + 'px';

  // Styles table fixe
  const thF = (w) => `background:var(--navy);color:#fff;font-size:10px;font-weight:600;padding:4px 8px;border:1px solid rgba(255,255,255,.15);white-space:nowrap;text-align:left;width:${w}px;min-width:${w}px;max-width:${w}px;position:sticky;top:0;z-index:10`;
  const thFCat = `background:var(--navy);color:#fff;font-size:10px;font-weight:600;padding:4px 8px;border:1px solid rgba(255,255,255,.15);white-space:nowrap;text-align:left;width:${W.cat}px;min-width:${W.cat}px;max-width:${W.cat}px;border-right:3px solid rgba(255,255,255,.4);position:sticky;top:0;z-index:10`;
  const thFMonth = `background:var(--navy-dark);color:#fff;font-size:10px;font-weight:600;padding:4px 8px;border:1px solid rgba(255,255,255,.15);position:sticky;top:0;z-index:10`;
  const tdF = (w, bg) => `background:${bg||'#fff'};font-size:11px;padding:4px 8px;border:1px solid var(--grey-200);vertical-align:middle;width:${w}px;min-width:${w}px;max-width:${w}px;overflow:hidden;text-overflow:ellipsis`;
  const tdFCat = (bg, color) => `background:${bg};font-size:10px;font-weight:700;padding:4px 8px;border:1px solid var(--grey-200);border-right:3px solid var(--grey-400);vertical-align:middle;width:${W.cat}px;min-width:${W.cat}px;max-width:${W.cat}px;color:${color}`;

  // Styles table scroll
  const thS = `background:var(--navy);color:#fff;font-size:10px;font-weight:600;padding:4px 6px;border:1px solid rgba(255,255,255,.15);white-space:nowrap;text-align:center;width:40px;min-width:40px;position:sticky;top:0;z-index:10`;
  const thSMonth = `background:var(--navy-dark);color:#fff;font-size:10px;font-weight:600;padding:4px 6px;border:1px solid rgba(255,255,255,.15);white-space:nowrap;text-align:center;position:sticky;top:0;z-index:10`;
  const tdCell = `font-size:11px;padding:3px 6px;border:1px solid var(--grey-200);text-align:center;vertical-align:middle;width:40px;min-width:40px`;

  // Données
  const fmtDate   = s => s ? new Date(s+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
  const fmtFiab   = s => s || '—';
  const fiabBg    = s => { if (!s) return null; if (s.startsWith('K1')) return '#d1fae5'; if (s.startsWith('K2')) return '#ffedd5'; if (s.startsWith('K3')) return '#fee2e2'; return null; };
  const fiabColor = s => { if (!s) return 'var(--grey-600)'; if (s.startsWith('K1')) return '#15803d'; if (s.startsWith('K2')) return '#c2410c'; if (s.startsWith('K3')) return '#b91c1c'; return 'var(--grey-600)'; };
  const rowBgA = '#fff', rowBgB = '#f7f9fc';
  const posteColors = { LA:'#1a3a5c', LS:'#1a7a4a', CONV:'#f07800' };

  // ── TABLE FIXE : en-têtes ──
  // Ligne mois : cellule vide sur toute la largeur
  let fMRow = `<tr><th colspan="6" style="${thFMonth};width:${TOTAL_FIXED}px"></th></tr>`;
  // Ligne colonnes
  let fHRow = `<tr>
    <th style="${thF(W.eotp)}">EOTP</th>
    <th style="${thF(W.lot)}">Lot</th>
    <th style="${thF(W.nom)}">Projet</th>
    <th style="${thF(W.cli)}">Client</th>
    <th style="${thF(W.fiab)}">Fiabilité</th>
    <th style="${thFCat}">Cat.</th>
  </tr>`;

  // ── TABLE SCROLL : en-têtes ──
  const monthMap = {};
  weeks.forEach(w => {
    const mo = new Date(w.dateDebut + 'T00:00:00');
    const key = mo.getFullYear() + '-' + mo.getMonth();
    monthMap[key] = (monthMap[key]||0) + 1;
  });
  let sMRow = '<tr>';
  Object.entries(monthMap).forEach(([k,n]) => {
    const [y,m] = k.split('-');
    sMRow += `<th colspan="${n}" style="${thSMonth}">${MONTHS_FR[parseInt(m)]} ${y}</th>`;
  });
  sMRow += '</tr>';
  let sHRow = '<tr>';
  weeks.forEach(w => {
    sHRow += `<th style="${thS}"><div>${w.label}</div><div style="font-weight:400;opacity:.75;font-size:9px">${w.labelDate}</div></th>`;
  });
  sHRow += '</tr>';

  // ── BODY ──
  let fixedBody = '';
  let scrollBody = '';

  if (projets.length === 0) {
    fixedBody = `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--grey-500)">Aucun projet</td></tr>`;
    scrollBody = `<tr><td colspan="${weeks.length}" style="padding:40px"></td></tr>`;
  } else {
    projets.forEach((p, pi) => {
      const rowBg = pi % 2 === 0 ? rowBgA : rowBgB;
      const fBg = fiabBg(p.Fiabilite) || rowBg;
      const nRows = RTE_POSTES.length;

      RTE_POSTES.forEach((poste, ri) => {
        const catColor = posteColors[poste];
        const isFirst = ri === 0;
        const sepTop = isFirst && pi > 0 ? 'border-top:2px solid var(--grey-300);' : '';

        // Table fixe : une ligne par poste
        if (isFirst) {
          // Première ligne du projet : rowspan sur EOTP/Lot/Nom/Client/Fiabilité
          fixedBody += `<tr>
            <td rowspan="${nRows}" style="${tdF(W.eotp,rowBg)};font-family:'DM Mono',monospace;font-size:10px;${sepTop}">${p.EOTP||'—'}</td>
            <td rowspan="${nRows}" style="${tdF(W.lot,rowBg)};font-weight:600;color:var(--navy);${sepTop}">${p.Lot||'—'}</td>
            <td rowspan="${nRows}" style="${tdF(W.nom,rowBg)};font-weight:600;color:var(--navy);${sepTop}" title="${(p.Nom||'').replace(/"/g,'')}">${p.Nom||'—'}</td>
            <td rowspan="${nRows}" style="${tdF(W.cli,rowBg)};font-size:10px;${sepTop}" title="${(p.Client||'').replace(/"/g,'')}">${p.Client||'—'}</td>
            <td rowspan="${nRows}" style="${tdF(W.fiab,fBg)};font-size:10px;font-weight:600;color:${fiabColor(p.Fiabilite)};${sepTop}">${fmtFiab(p.Fiabilite)}</td>
            <td style="${tdFCat(rowBg,catColor)};${sepTop}">${poste}</td>
          </tr>`;
        } else {
          fixedBody += `<tr><td style="${tdFCat(rowBg,catColor)}">${poste}</td></tr>`;
        }

        // Table scroll : une ligne par poste
        scrollBody += '<tr>';
        weeks.forEach(w => {
          const etp = rteETP(p.id, poste, w);
          if (etp > 0) {
            const bg = poste==='LA'?'rgba(26,58,92,0.1)':poste==='LS'?'rgba(26,122,74,0.1)':'rgba(240,120,0,0.1)';
            scrollBody += `<td style="${tdCell};${sepTop}background:${bg};color:${catColor};font-weight:700;font-family:'DM Mono',monospace">${etp}</td>`;
          } else {
            scrollBody += `<td style="${tdCell};${sepTop}color:#ddd"></td>`;
          }
        });
        scrollBody += '</tr>';
      });

      // Séparateur entre projets
      fixedBody += `<tr style="height:2px"><td colspan="6" style="background:var(--grey-300);padding:0;border:none"></td></tr>`;
      scrollBody += `<tr style="height:2px"><td colspan="${weeks.length}" style="background:var(--grey-300);padding:0;border:none"></td></tr>`;
    });
  }

  tblF.innerHTML = `<colgroup>
    <col style="width:${W.eotp}px">
    <col style="width:${W.lot}px">
    <col style="width:${W.nom}px">
    <col style="width:${W.cli}px">
    <col style="width:${W.fiab}px">
    <col style="width:${W.cat}px">
  </colgroup><thead>${fMRow}${fHRow}</thead><tbody>${fixedBody}</tbody>`;

  tblS.innerHTML = `<thead>${sMRow}${sHRow}</thead><tbody>${scrollBody}</tbody>`;

  // Synchroniser les hauteurs de lignes entre les deux tables
  requestAnimationFrame(() => {
    const rowsF = tblF.querySelectorAll('tbody tr');
    const rowsS = tblS.querySelectorAll('tbody tr');
    const len = Math.min(rowsF.length, rowsS.length);
    for (let i = 0; i < len; i++) {
      // Reset pour recalculer
      rowsF[i].style.height = '';
      rowsS[i].style.height = '';
    }
    for (let i = 0; i < len; i++) {
      const hF = rowsF[i].getBoundingClientRect().height;
      const hS = rowsS[i].getBoundingClientRect().height;
      const h  = Math.max(hF, hS);
      rowsF[i].style.height = h + 'px';
      rowsS[i].style.height = h + 'px';
    }
    // Synchroniser aussi les headers (2 lignes : mois + semaines)
    const hRowsF = tblF.querySelectorAll('thead tr');
    const hRowsS = tblS.querySelectorAll('thead tr');
    const hLen = Math.min(hRowsF.length, hRowsS.length);
    for (let i = 0; i < hLen; i++) {
      const hF = hRowsF[i].getBoundingClientRect().height;
      const hS = hRowsS[i].getBoundingClientRect().height;
      const h  = Math.max(hF, hS);
      hRowsF[i].style.height = h + 'px';
      hRowsS[i].style.height = h + 'px';
    }
  });

  // ── Activer scroll vertical + horizontal ──────────────────────
  const scrollEl = document.getElementById('rteScroll');
  const fixedEl  = document.getElementById('rteFixed');

  // Calculer la hauteur disponible = fenêtre - position top du wrapper
  const wrapper = scrollEl.closest('div[style*="border:1px solid"]') || scrollEl.parentElement;
  const wrapperTop = wrapper ? wrapper.getBoundingClientRect().top : 200;
  const availH = Math.max(200, window.innerHeight - wrapperTop - 32);

  // Appliquer overflow + hauteur max sur les deux divs
  scrollEl.style.overflowX = 'auto';
  scrollEl.style.overflowY = 'auto';
  scrollEl.style.maxHeight = availH + 'px';

  fixedEl.style.overflowX = 'hidden';
  fixedEl.style.overflowY = 'scroll';
  fixedEl.style.scrollbarWidth = 'none'; // Firefox
  fixedEl.style.maxHeight = availH + 'px';

  // Cacher scrollbar webkit sur rteFixed
  if (!document.getElementById('_rteFixedStyle')) {
    const s = document.createElement('style');
    s.id = '_rteFixedStyle';
    s.textContent = '#rteFixed::-webkit-scrollbar{display:none}';
    document.head.appendChild(s);
  }

  // Synchroniser le scroll vertical
  if (scrollEl._syncHandler) scrollEl.removeEventListener('scroll', scrollEl._syncHandler);
  scrollEl._syncHandler = () => { fixedEl.scrollTop = scrollEl.scrollTop; };
  scrollEl.addEventListener('scroll', scrollEl._syncHandler);
}

function renderRTECap() {
  const RTE_N_WEEKS = 52;
  const startVal = document.getElementById('rteStart').value;
  const startDate = startVal || fmtISO(new Date());
  const weeks = rteGetWeeks(startDate, RTE_N_WEEKS);

  const tbl = document.getElementById('rteCapTable');
  const thBase = 'position:sticky;top:0;z-index:11;background:var(--navy);color:#fff;font-size:10px;font-weight:600;padding:4px 6px;border:1px solid rgba(255,255,255,.15);white-space:nowrap;text-align:center';
  const thSticky = (left) => `position:sticky;left:${left}px;top:0;z-index:30;background:var(--navy);color:#fff;font-size:10px;font-weight:600;padding:4px 8px;border:1px solid rgba(255,255,255,.15);white-space:nowrap;text-align:left`;
  const tdFixed  = (left,bg) => `position:sticky;left:${left}px;z-index:3;background:${bg||'#fff'};font-size:11px;padding:4px 8px;border:1px solid var(--grey-200);vertical-align:middle`;
  const tdCell   = 'font-size:11px;padding:3px 6px;border:1px solid var(--grey-200);text-align:center;vertical-align:middle;font-family:"DM Mono",monospace';

  const WCOL = 120, WROW = 46;

  // Ligne mois
  const monthMap = {};
  weeks.forEach(w => {
    const mo = new Date(w.dateDebut + 'T00:00:00');
    const key = mo.getFullYear() + '-' + mo.getMonth();
    monthMap[key] = (monthMap[key]||0) + 1;
  });
  let mRow = `<tr><th colspan="2" style="position:sticky;left:0;top:0;z-index:40;background:var(--navy-dark);color:#fff;font-size:10px;font-weight:600;padding:4px 8px;border:1px solid rgba(255,255,255,.15)"></th>`;
  Object.entries(monthMap).forEach(([k,n]) => {
    const [y,m] = k.split('-');
    mRow += `<th colspan="${n}" style="${thBase};background:var(--navy-dark)">${MONTHS_FR[parseInt(m)]} ${y}</th>`;
  });
  mRow += '</tr>';

  // Ligne semaines
  let hRow = `<tr>
    <th style="${thSticky(0)};min-width:${WCOL}px;width:${WCOL}px">Section</th>
    <th style="${thSticky(WCOL)};min-width:${WROW}px;width:${WROW}px;border-right:2px solid rgba(255,255,255,.3)">Poste</th>`;
  weeks.forEach(w => {
    hRow += `<th style="${thBase};min-width:40px;width:40px"><div>${w.label}</div><div style="font-weight:400;opacity:.75;font-size:9px">${w.labelDate}</div></th>`;
  });
  hRow += '</tr>';

  // Calcul capacité / planifié / disponible par poste par semaine
  const SECTIONS = ['Capacité','Planifié','Disponible'];
  const secColors = { Capacité:'#1a3a5c', Planifié:'#c2410c', Disponible:'#15803d' };
  const secBgs    = { Capacité:'rgba(26,58,92,0.07)', Planifié:'rgba(234,88,12,0.07)', Disponible:'rgba(22,163,74,0.07)' };
  const posteColors = { LA:'#1a3a5c', LS:'#1a7a4a', CONV:'#f07800' };

  function capaciteETP(poste, week) {
    // Capacité nette = 40h − fériés − absences, par ressource du poste, converti en ETP
    const rscList = ressources.filter(r => r.Poste === poste);
    let totalETP = 0;
    rscList.forEach(r => {
      const full = rscName(r);
      const pays = r.Pays || 'France';
      let dispoH = 40;
      for (let d = 0; d < 5; d++) {
        const ds = fmtISO(addDays(new Date(week.dateDebut + 'T00:00:00'), d));
        if (isFerie(ds, pays)) { dispoH -= 8; continue; }
        const abs = absences.find(a => a.Ressource === full && a.Date === ds);
        if (abs) dispoH -= abs.Heures;
      }
      dispoH = Math.max(0, dispoH);
      totalETP += Math.round((dispoH / 40) * 10) / 10;
    });
    return Math.round(totalETP * 10) / 10;
  }

  function planifieETP(poste, week) {
    let total = 0;
    projets.forEach(p => { total += rteETP(p.id, poste, week); });
    return Math.round(total * 10) / 10;
  }

  // Couleurs opaques pour les fonds sticky (pas de transparence pour éviter le bleeding)
  const secBgSolid  = { Capacité:'#e8f0f8', Planifié:'#fdf0e6', Disponible:'#d1fae5' };
  const rowBgSolid  = ['#eef3f9', '#fdf0e6', '#ffffff'];

  let body = '';
  SECTIONS.forEach((section, si) => {
    const secColor    = secColors[section];
    const secBgOpaque = secBgSolid[section];
    const nSubRows    = RTE_POSTES.length;

    RTE_POSTES.forEach((poste, pi) => {
      const pColor = posteColors[poste];

      let row = '<tr>';
      // Cellule Section (sticky gauche) : fond coloré par section
      if (pi === 0) {
        row += `<td rowspan="${nSubRows}" style="${tdFixed(0, secBgOpaque)};min-width:${WCOL}px;font-weight:700;color:${secColor};font-size:12px;border-right:1px solid var(--grey-200)">${section}</td>`;
      }
      // Cellule Poste : toujours fond BLANC
      row += `<td style="${tdFixed(WCOL, '#fff')};min-width:${WROW}px;font-size:10px;font-weight:700;color:${pColor};border-right:2px solid var(--grey-300)">${poste}</td>`;

      weeks.forEach(w => {
        const cap = capaciteETP(poste, w);
        const pla = planifieETP(poste, w);
        let val = 0;
        if (section === 'Capacité')   val = cap;
        if (section === 'Planifié')   val = pla;
        if (section === 'Disponible') val = Math.round((cap - pla) * 10) / 10;

        let cellBg, cellColor, fw, cellTxt;
        if (section === 'Disponible') {
          // Mise en forme conditionnelle : vert >0 / orange =0 / rouge <0
          if      (val > 0) { cellBg = '#d1fae5'; cellColor = '#15803d'; }
          else if (val < 0) { cellBg = '#fee2e2'; cellColor = '#b91c1c'; }
          else              { cellBg = '#ffedd5'; cellColor = '#c2410c'; }
          fw = '700'; cellTxt = String(val);
        } else {
          // Capacité / Planifié : fond blanc, texte noir non gras
          cellBg    = '#fff';
          cellColor = '#333';
          fw        = '400';
          cellTxt   = val !== 0 ? String(val) : '';
        }
        row += `<td style="font-size:11px;padding:3px 6px;border:1px solid var(--grey-200);text-align:center;vertical-align:middle;font-family:'DM Mono',monospace;background:${cellBg};color:${cellColor};font-weight:${fw}">${cellTxt}</td>`;
      });

      row += '</tr>';
      body += row;
    });

    body += `<tr style="height:3px"><td colspan="${2 + weeks.length}" style="background:var(--grey-400);padding:0;border:none"></td></tr>`;
  });

  tbl.innerHTML = `<thead>${mRow}${hRow}</thead><tbody>${body}</tbody>`;

  // ── Graphique dans le même scroll que le tableau ──
  // Légende(120px) + AxeY(46px) = 166px sticky = même que WCOL+WROW du tableau
  const COL_W = 40;
  const chartDataW = weeks.length * COL_W;

  const laPlans = weeks.map(w => planifieETP('LA',   w));
  const lsPlans = weeks.map(w => planifieETP('LS',   w));
  const cvPlans = weeks.map(w => planifieETP('CONV', w));
  const capTot  = weeks.map(w => capaciteETP('LA', w) + capaciteETP('LS', w) + capaciteETP('CONV', w));
  const labels  = weeks.map(w => w.label);

  // Canvas données : largeur exacte des colonnes semaines (52×40=2080px)
  const chartWrap = document.getElementById('rteCapChartWrap');
  if (chartWrap) { chartWrap.style.width = chartDataW + 'px'; }

  // Calcul max Y pour synchroniser les deux axes
  const maxY = Math.max(...capTot, ...laPlans.map((v,i) => v + lsPlans[i] + cvPlans[i])) + 1;

  // ── Canvas données (barres + ligne, sans axe Y) ──
  const ctx = document.getElementById('rteCapChart');
  if (!ctx) return;
  if (ctx._chartInstance) { ctx._chartInstance.destroy(); ctx._chartInstance = null; }
  ctx._chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label:'LA',       data:laPlans, backgroundColor:'#1a3a5c', stack:'planifie', order:2, barPercentage:0.85, categoryPercentage:0.9 },
        { label:'LS',       data:lsPlans, backgroundColor:'#1a7a4a', stack:'planifie', order:2, barPercentage:0.85, categoryPercentage:0.9 },
        { label:'CONV',     data:cvPlans, backgroundColor:'#f07800', stack:'planifie', order:2, barPercentage:0.85, categoryPercentage:0.9 },
        { type:'line', label:'Capacité', data:capTot,
          borderColor:'#e53e3e', backgroundColor:'transparent',
          borderWidth:2, pointRadius:0, pointHoverRadius:4, tension:0, fill:false, order:1 }
      ]
    },
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction:{ mode:'index', intersect:false },
      plugins:{ legend:{display:false}, tooltip:{ callbacks:{ label: c => `${c.dataset.label}: ${c.parsed.y} ETP` } } },
      scales:{
        x:{ stacked:true, ticks:{ font:{size:9}, maxRotation:0, autoSkip:false }, grid:{color:'rgba(0,0,0,0.05)'}, border:{display:false} },
        y:{ display:false, stacked:true, beginAtZero:true, max:maxY }
      },
      layout:{ padding:{ right:4, top:4, bottom:4 } }
    }
  });

  // ── Canvas axe Y (fixe, sans données visibles) ──
  const ctxAxis = document.getElementById('rteCapAxisChart');
  if (!ctxAxis) return;
  if (ctxAxis._chartInstance) { ctxAxis._chartInstance.destroy(); ctxAxis._chartInstance = null; }
  ctxAxis._chartInstance = new Chart(ctxAxis, {
    type:'bar',
    data:{ labels:[''], datasets:[{ data:[0], backgroundColor:'transparent' }] },
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false}, tooltip:{enabled:false} },
      scales:{
        x:{ display:false },
        y:{ display:true, beginAtZero:true, max:maxY,
            ticks:{ font:{size:10} }, grid:{color:'rgba(0,0,0,0.06)'} }
      },
      layout:{ padding:{ top:4, bottom:4, right:0, left:2 } }
    }
  });

  // Scroll unique — pas besoin de synchronisation
}


// ═══════════════════════════════════════════════════════════════
function syncHeadWidth(prefix) {
  const bodyTable = document.getElementById(prefix + 'Table');
  const headTable = document.getElementById(prefix + 'HeadTable');
  const headWrap  = document.getElementById(prefix + 'HeadWrap');
  if (!bodyTable || !headTable || !headWrap) return;
  // Aligner la largeur totale
  const w = bodyTable.offsetWidth;
  headTable.style.width = w + 'px';
  headTable.style.minWidth = w + 'px';
  // Aligner chaque colonne via colgroup
  const bodyTr = bodyTable.querySelector('tbody tr');
  const headTrs = headTable.querySelectorAll('thead tr');
  if (!bodyTr || headTrs.length === 0) return;
  const bodyCells = bodyTr.querySelectorAll('td');
  const headLastTr = headTrs[headTrs.length - 1];
  const headCells  = headLastTr.querySelectorAll('th');
  headCells.forEach((th, i) => {
    if (bodyCells[i]) {
      const cw = bodyCells[i].offsetWidth;
      th.style.width = cw + 'px';
      th.style.minWidth = cw + 'px';
    }
  });
}
