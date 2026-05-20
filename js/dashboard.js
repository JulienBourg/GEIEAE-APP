// ═══════════════════════════════════════════════════════════════
// TABLEAU DE BORD
// ═══════════════════════════════════════════════════════════════
let dbChartBar     = null;
let dbChartPoste   = null;

// ── Helpers ──────────────────────────────────────────────────
function dbGetWeeks(startDate, n) {
  // Retourne n semaines à partir du lundi de startDate
  const weeks = [];
  let cur = getMonday(new Date(startDate + 'T00:00:00'));
  for (let i = 0; i < n; i++) {
    const wEnd = addDays(cur, 6);
    weeks.push({
      label: 'S' + getWeekNum(cur) + ' ' + cur.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}),
      labelShort: 'S' + getWeekNum(cur),
      labelDate: cur.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}),
      dateDebut: fmtISO(cur),
      dateFin:   fmtISO(wEnd),
      year: cur.getFullYear()
    });
    cur = addDays(cur, 7);
  }
  return weeks;
}

function dbWorkDays(dateDebut, dateFin) {
  let n = 0, cur = new Date(dateDebut + 'T00:00:00');
  const end = new Date(dateFin + 'T00:00:00');
  while (cur <= end) { if (!isWE(cur)) n++; cur = addDays(cur, 1); }
  return n;
}

function dbWeekData(rscList, week) {
  // Pour une semaine, retourne {cap, hProj, hAbs, hHP, hFerie, capNette}
  let cap = 0, hProj = 0, hAbs = 0, hHP = 0, hFerie = 0;
  rscList.forEach(r => {
    const full = rscName(r);
    const pays = r.Pays || 'France';
    const lignes = lignesProjets.filter(l => l.ressource === full);
    cap += 40; // 40h/semaine par ressource
    for (let d = 0; d < 5; d++) {
      const ds = fmtISO(addDays(new Date(week.dateDebut + 'T00:00:00'), d));
      if (isFerie(ds, pays)) {
        hFerie += 8;
      } else {
        const abs = absences.find(a => a.Ressource === full && a.Date === ds);
        if (abs) hAbs += abs.Heures;
        const hp = horsProjets.find(a => a.Ressource === full && a.Date === ds);
        if (hp) hHP += hp.Heures;
        lignes.forEach(l => {
          const h = heuresProjets.find(x => x.ligneId === l.id && x.date === ds);
          if (h) hProj += h.heures;
        });
      }
    }
  });
  const capNette = Math.max(0, cap - hFerie - hAbs);
  // charge planifiée = projets + hors-projets UNIQUEMENT (absences et fériés déjà déduits de la capacité)
  const charge = hProj + hHP;
  return { cap: capNette, hProj, hAbs, hHP, hFerie, capNette,
           charge,
           dispo: Math.max(0, capNette - charge) };
}

// ── Render principal ─────────────────────────────────────────
function renderDashboard() {
  const fEnt  = document.getElementById('dbFilterEnt').value;
  const startVal = document.getElementById('dbFilterStart').value;
  const startDate = startVal || fmtISO(new Date());

  // Ressources filtrées
  const rscAll = ressources.filter(r => !fEnt || r.Entreprise === fEnt);

  // Info résumé toolbar
  document.getElementById('dbInfo').textContent =
    rscAll.length + ' ressource' + (rscAll.length > 1 ? 's' : '') +
    (fEnt ? ' · ' + (fEnt === 'Atlantique Etudes' ? 'AE' : 'EQOS') : ' · Toutes entreprises');

  // Label filtres pour les sous-titres des modules
  const entLabel = fEnt ? (fEnt === 'Atlantique Etudes' ? 'AE' : 'EQOS') : 'Toutes entreprises';
  const dateLabel = startVal
    ? 'à partir du ' + new Date(startVal+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})
    : "à partir d'aujourd'hui";
  const filterTag = `<span style="background:var(--navy-xl);color:var(--navy);padding:1px 8px;border-radius:10px;font-weight:600;font-size:10px;margin-left:4px">${entLabel}</span><span style="background:#fff3e0;color:var(--orange);padding:1px 8px;border-radius:10px;font-weight:600;font-size:10px;margin-left:4px">📅 ${dateLabel}</span>`;

  const setSubtitle = (id, txt) => { const el=document.getElementById(id); if(el) el.innerHTML=txt+' '+filterTag; };
  setSubtitle('dbPosteSubtitle', 'Répartition LA · LS · CONV — projets + hors projets — 6 mois');
  setSubtitle('dbTableSubtitle', 'Capacité · Charge · Disponible — en heures');
  setSubtitle('dbBarSubtitle', 'Barres = charge planifiée · Courbe = capacité nette (−fériés −absences)');

  // ── 1. CARTE CAPACITÉ UNIQUE ────────────────────────────────
  const postes = ['LA', 'LS', 'CONV'];
  const posteColors = { LA: '#1a3a5c', LS: '#1a7a4a', CONV: '#f07800' };
  const posteIcons  = { LA: '⚡', LS: '🔧', CONV: '🤝' };
  const totalRsc = rscAll.length;
  const cardBody = postes.map(p => {
    const cnt = rscAll.filter(r => r.Poste === p).length;
    const col = posteColors[p];
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 0;border-bottom:1px solid var(--grey-100)">
      <div style="display:flex;align-items:center;gap:8px">
        <span style="font-size:13px">${posteIcons[p]}</span>
        <span style="font-size:13px;font-weight:700;color:${col}">${p}</span>
      </div>
      <span style="font-size:22px;font-weight:700;color:${col};font-family:'DM Mono',monospace">${cnt}</span>
    </div>`;
  }).join('') +
  `<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0 0">
    <span style="font-size:11px;color:var(--grey-500)">Total</span>
    <span style="font-size:18px;font-weight:700;color:var(--navy);font-family:'DM Mono',monospace">${totalRsc}</span>
  </div>`;
  document.getElementById('dbCapCardBody').innerHTML = cardBody;

  // ── Carte : Projets en cours (filtré par entreprise) ──
  const projEnCours = projets.filter(p => p.Statut === 'En cours' && (!fEnt || p.Entite === fEnt));
  const projCardEl = document.getElementById('dbProjetsBody');
  if (projCardEl) {
    if (projEnCours.length === 0) {
      projCardEl.innerHTML = '<div style="font-size:12px;color:var(--grey-500);text-align:center;padding:20px 0">Aucun projet en cours</div>';
    } else {
      const bigNum = `<div style="font-size:52px;font-weight:800;color:var(--orange);font-family:'DM Mono',monospace;line-height:1;margin-bottom:6px">${projEnCours.length}</div>`;
      const typeColors = { LA: '#1a3a5c', LS: '#1a7a4a', Mixte: '#f07800' };
      const byPoste = ['LA', 'LS', 'Mixte'].map(typ => {
        const n = projEnCours.filter(p => p.Type === typ).length;
        const col = typeColors[typ] || '#666';
        return n ? `<span style="font-size:11px;font-weight:600;color:${col};margin-right:10px">${typ}: ${n}</span>` : '';
      }).join('');
      projCardEl.innerHTML = bigNum + `<div style="margin-top:4px">${byPoste}</div>`;
    }
  }

  // ── Carte : Prochains jalons (mois en cours + mois suivant, filtré entreprise) ──
  const todayISO2 = fmtISO(new Date());
  const now2 = new Date();
  const endNextMo = fmtISO(new Date(now2.getFullYear(), now2.getMonth() + 2, 0));
  const jalonsDB = ganttTaches
    .filter(t => {
      if (!t.jalon || t.jalon < todayISO2 || t.jalon > endNextMo) return false;
      if (!fEnt) return true;
      const proj = projets.find(p => p.id === t.projetId);
      return proj && proj.Entite === fEnt;
    })
    .sort((a,b) => a.jalon.localeCompare(b.jalon));
  const jalonsEl = document.getElementById('dbJalonsBody');
  if (jalonsEl) {
    const fmtDj = s => new Date(s+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});
    if (jalonsDB.length === 0) {
      jalonsEl.innerHTML = '<div style="font-size:11px;color:var(--grey-500);padding:8px 0">Aucun jalon ce mois-ci</div>';
    } else {
      jalonsEl.innerHTML = jalonsDB.map(t => {
        const proj = projets.find(p => p.id === t.projetId);
        const nom  = proj ? (proj.Nom || proj.Commande || '—') : '—';
        return `<div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-bottom:1px solid var(--grey-100)">
          <span style="font-size:10px;font-weight:700;color:var(--orange);font-family:'DM Mono',monospace;flex-shrink:0;padding-top:1px">${fmtDj(t.jalon)}</span>
          <span style="font-size:11px;color:var(--grey-600);line-height:1.4"><span style="font-weight:600;color:var(--navy)">${nom}</span><br>${t.nom}</span>
        </div>`;
      }).join('');
    }
  }

  // ── 2. TABLEAU PÉRIODIQUE 12 semaines ──────────────────────
  const weeks12 = dbGetWeeks(startDate, 12);
  const thS = 'padding:6px 10px;font-size:10px;font-weight:600;color:#fff;background:var(--navy);text-align:center;white-space:nowrap;border-right:1px solid rgba(255,255,255,.1)';
  const thSL = 'padding:6px 14px;font-size:10px;font-weight:600;color:#fff;background:var(--navy);text-align:left;border-right:1px solid rgba(255,255,255,.1)';
  const thM = 'padding:4px 8px;font-size:9px;font-weight:600;color:#fff;background:var(--navy-dark);text-align:center;border-right:1px solid rgba(255,255,255,.1)';

  // Ligne mois
  const yearMonthBlocks = {};
  weeks12.forEach(w => {
    const mo = new Date(w.dateDebut + 'T00:00:00');
    const key = mo.getFullYear() + '-' + mo.getMonth();
    yearMonthBlocks[key] = (yearMonthBlocks[key] || 0) + 1;
  });
  let mRow = `<tr><th style="${thSL}" rowspan="2">Indicateur</th>`;
  Object.entries(yearMonthBlocks).forEach(([k, n]) => {
    const [y, m] = k.split('-');
    mRow += `<th colspan="${n}" style="${thM}">${MONTHS_FR[parseInt(m)]} ${y}</th>`;
  });
  mRow += '</tr>';

  let hRow = '<tr>';
  weeks12.forEach(w => {
    hRow += `<th style="${thS}"><div style="font-weight:700">${w.labelShort}</div><div style="opacity:.7;font-weight:400;font-size:9px">${w.labelDate}</div></th>`;
  });
  hRow += '</tr>';

  // Données semaine par semaine pour toutes ressources
  const weekDataCache = weeks12.map(w => dbWeekData(rscAll, w));
  // Données par poste
  const postesTab = ['LA','LS','CONV'];
  const posteColors3 = { LA:'#1a3a5c', LS:'#1a7a4a', CONV:'#f07800' };
  const weekDataPoste = {};
  postesTab.forEach(p => {
    const rscP = rscAll.filter(r => r.Poste === p);
    weekDataPoste[p] = weeks12.map(w => dbWeekData(rscP, w));
  });

  const tdSbase = 'padding:7px 10px;text-align:center;border-right:1px solid var(--grey-200);border-bottom:1px solid var(--grey-200);font-size:11px;font-family:DM Mono,monospace';
  const tdLabel = (txt, color, bold, borderRight) =>
    `<td style="padding:5px 12px;font-size:11px;font-weight:${bold?'700':'600'};color:${color};border-right:${borderRight||'2px solid var(--grey-300)'};border-bottom:1px solid var(--grey-200);white-space:nowrap;background:inherit">${txt}</td>`;

  function makeRow(label, vals, getColor, bg, bold, subRow) {
    const pad = subRow ? 'padding:3px 10px 3px 22px' : 'padding:5px 10px';
    let tr = `<tr style="background:${bg}">` + tdLabel(label, getColor(null, null), bold, subRow ? '1px solid var(--grey-200)' : '2px solid var(--grey-300)');
    vals.forEach((val, i) => {
      const col = getColor(val, weekDataCache[i]);
      tr += `<td style="${tdSbase};${pad};font-weight:${bold?'700':'500'};color:${col}">${val > 0 ? val + 'h' : '<span style="opacity:.3">—</span>'}</td>`;
    });
    return tr + '</tr>';
  }

  // Ligne capacité totale
  const rowCap = makeRow('📦 Capacité totale (h)',
    weekDataCache.map(d => d.cap),
    () => 'var(--navy)', 'var(--navy-xl)', true, false);

  // Sous-lignes capacité par poste
  const rowsCapPoste = postesTab.map(p => {
    const col = posteColors3[p];
    const vals = weekDataPoste[p].map(d => d.cap);
    return `<tr style="background:var(--navy-xl)">` +
      tdLabel(`<span style="color:${col}">↳ ${p}</span>`, col, false, '1px solid var(--grey-200)') +
      vals.map(v => `<td style="${tdSbase};padding:5px 10px 5px 22px;font-size:10px;color:${col}">${v > 0 ? v + 'h' : '<span style="opacity:.25">—</span>'}</td>`).join('') +
      '</tr>';
  }).join('');

  // Ligne charge totale
  const rowCharge = makeRow('⚡ Charge planifiée (h)',
    weekDataCache.map(d => d.charge),
    (val, wd) => { if (!wd) return 'var(--green)'; const p=wd.cap>0?wd.charge/wd.cap:0; return p>=1?'var(--red)':p>=0.8?'var(--orange)':'var(--green)'; },
    'rgba(26,122,74,0.18)', false, false);

  // Sous-lignes charge par poste
  const rowsChargePoste = postesTab.map(p => {
    const col = posteColors3[p];
    const vals = weekDataPoste[p].map(d => d.charge);
    return `<tr style="background:rgba(26,122,74,0.09)">` +
      tdLabel(`<span style="color:${col}">↳ ${p}</span>`, col, false, '1px solid var(--grey-200)') +
      vals.map(v => `<td style="${tdSbase};padding:5px 10px 5px 22px;font-size:10px;color:${col}">${v > 0 ? v + 'h' : '<span style="opacity:.25">—</span>'}</td>`).join('') +
      '</tr>';
  }).join('');

  // Ligne disponible
  const rowDispo = makeRow('🟢 Disponible (h)',
    weekDataCache.map(d => d.dispo),
    (val, wd) => { if (!wd) return 'var(--green)'; return val===0?'var(--red)':val<wd.cap*0.2?'var(--orange)':'var(--green)'; },
    'rgba(26,122,74,0.14)', false, false);

  // Sous-lignes disponible par poste
  const rowsDispoPoste = postesTab.map(p => {
    const col = posteColors3[p];
    const vals = weekDataPoste[p].map(d => d.dispo);
    return `<tr style="background:rgba(26,122,74,0.07)">` +
      tdLabel(`<span style="color:${col}">↳ ${p}</span>`, col, false, '1px solid var(--grey-200)') +
      vals.map((v, i) => {
        const wd = weekDataPoste[p][i];
        const col2 = v===0 ? 'var(--red)' : v < wd.cap*0.2 ? 'var(--orange)' : col;
        return `<td style="${tdSbase};padding:4px 10px 4px 22px;font-size:10px;color:${col2}">${v > 0 ? v + 'h' : '<span style="opacity:.25">—</span>'}</td>`;
      }).join('') +
      '</tr>';
  }).join('');

  // Ligne taux
  let tauxRow = `<tr style="background:var(--navy-xl)">` +
    tdLabel('📊 Taux occupation (%)', 'var(--navy)', true);
  weekDataCache.forEach(wd => {
    const pct = wd.cap > 0 ? Math.round(wd.charge / wd.cap * 100) : 0;
    const col = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--orange)' : pct > 0 ? 'var(--green)' : 'var(--grey-400)';
    const bg  = pct >= 100 ? 'rgba(204,32,32,0.1)' : pct >= 80 ? 'rgba(240,120,0,0.1)' : pct > 0 ? 'rgba(26,122,74,0.1)' : '';
    tauxRow += `<td style="${tdSbase};padding:5px 10px;font-weight:700;color:${col};background:${bg}">${pct > 0 ? pct + '%' : '—'}</td>`;
  });
  tauxRow += '</tr>';

  document.getElementById('dbPeriodTable').innerHTML = mRow + hRow + rowCap + rowsCapPoste + rowCharge + rowsChargePoste + rowDispo + rowsDispoPoste + tauxRow;

  // ── 3. GRAPHIQUE BÂTON + COURBE (16 semaines) ──────────────
  const weeks16 = dbGetWeeks(startDate, 16);
  const wData16 = weeks16.map(w => dbWeekData(rscAll, w));
  const labelsW = weeks16.map(w => w.labelShort + ' ' + w.labelDate);

  if (dbChartBar) dbChartBar.destroy();
  const ctxBar = document.getElementById('dbChartBar').getContext('2d');
  dbChartBar = new Chart(ctxBar, {
    type: 'bar',
    data: {
      labels: weeks16.map(w => [w.labelShort, w.labelDate]),
      datasets: [
        {
          type: 'bar', label: 'Projets',
          data: wData16.map(d => d.hProj),
          backgroundColor: '#1a3a5ccc', stack: 'charge', borderRadius: 2, borderSkipped: false, order: 2
        },
        {
          type: 'bar', label: 'Hors projets',
          data: wData16.map(d => d.hHP),
          backgroundColor: '#f07800cc', stack: 'charge', borderRadius: 0, borderSkipped: false, order: 2
        },
        {
          type: 'line', label: 'Capacité nette (−fériés −absences)',
          data: wData16.map(d => d.capNette),
          borderColor: '#1a7a4a', backgroundColor: 'rgba(26,122,74,0.06)',
          borderWidth: 2.5, pointRadius: 3, pointBackgroundColor: '#1a7a4a',
          tension: 0.3, fill: false, order: 1
        },
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 11 }, boxWidth: 13, padding: 14 } },
        tooltip: { callbacks: {
          label: ctx => ` ${ctx.dataset.label} : ${ctx.parsed.y}h`
        }}
      },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 9 } } },
        y: {
          stacked: false, min: 0,
          ticks: { callback: v => v + 'h', font: { size: 10 }, stepSize: 40 },
          grid: { color: '#e5e7eb' }
        }
      }
    }
  });

  // ── 4. CAMEMBERT par poste — 6 mois ─────────────────────────
  const weeks26 = dbGetWeeks(startDate, 26); // ~6 mois
  const dateDebut6 = weeks26[0].dateDebut;
  const dateFin6   = weeks26[weeks26.length-1].dateFin;

  const posteHours = { LA: 0, LS: 0, CONV: 0 };
  rscAll.forEach(r => {
    const full = rscName(r);
    const poste = r.Poste;
    if (!posteHours.hasOwnProperty(poste)) return;
    const lignes = lignesProjets.filter(l => l.ressource === full);
    lignes.forEach(l => {
      heuresProjets.filter(x => x.ligneId === l.id && x.date >= dateDebut6 && x.date <= dateFin6)
        .forEach(x => { posteHours[poste] += x.heures; });
    });
    // Hors projets aussi
    horsProjets.filter(x => x.Ressource === full && x.Date >= dateDebut6 && x.Date <= dateFin6)
      .forEach(x => { posteHours[poste] += x.Heures; });
  });

  if (dbChartPoste) dbChartPoste.destroy();
  const ctxPoste = document.getElementById('dbChartPoste').getContext('2d');
  const totalH6 = Object.values(posteHours).reduce((a,b) => a+b, 0);
  dbChartPoste = new Chart(ctxPoste, {
    type: 'doughnut',
    data: {
      labels: ['LA', 'LS', 'CONV'],
      datasets: [{
        data: [posteHours.LA, posteHours.LS, posteHours.CONV],
        backgroundColor: ['#1a3a5ccc', '#1a7a4acc', '#f07800cc'],
        borderWidth: 2, borderColor: '#fff', hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 12 }, boxWidth: 14, padding: 14 } },
        tooltip: { callbacks: { label: ctx => {
          const total = ctx.dataset.data.reduce((a,b)=>a+b,0);
          return ` ${ctx.label} : ${ctx.parsed}h (${total>0?Math.round(ctx.parsed/total*100):0}%)`;
        }}}
      }
    },
    plugins: [{
      id: 'centerText',
      afterDraw(chart) {
        if (totalH6 === 0) return;
        const { ctx, chartArea } = chart;
        const cx = (chartArea.left + chartArea.right) / 2;
        const cy = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'var(--navy)';
        ctx.font = 'bold 18px DM Mono, monospace';
        ctx.fillText(totalH6 + 'h', cx, cy - 8);
        ctx.fillStyle = '#9ca3af';
        ctx.font = '11px DM Sans, sans-serif';
        ctx.fillText('total planifié', cx, cy + 10);
        ctx.restore();
      }
    }]
  });


}


// Initialiser la date de début au lundi courant
function dbInit() {
  const el = document.getElementById('dbFilterStart');
  if (el && !el.value) el.value = fmtISO(getMonday(new Date()));
}
