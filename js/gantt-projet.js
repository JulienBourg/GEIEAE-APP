// ═══════════════════════════════════════════════════════════════
// GANTT PROJET
// ═══════════════════════════════════════════════════════════════
let ganttProjId = null;
let ganttStart = getMonday(new Date());
let ganttScale = 'day'; // 'day' | 'week' | 'month'
const GANTT_DAYS = 56;
let curGanttTacheId = null;

function setGanttScale(scale) {
  ganttScale = scale;
  ['day','week','month'].forEach(s => {
    const btn = document.getElementById('ganttScale' + s.charAt(0).toUpperCase() + s.slice(1));
    if (btn) { btn.style.background = s===scale ? 'var(--navy)' : ''; btn.style.color = s===scale ? '#fff' : ''; }
  });
  renderGantt();
}

function openGanttProjet(projId) {
  ganttProjId = projId;
  const p = projets.find(x => x.id === projId);
  document.getElementById('ganttProjTitle').textContent = '📊 Gantt — ' + p.Nom;
  document.getElementById('ganttProjSub').textContent = (p.Commande||'') + ' · ' + (p.Client||'');
  const taches = ganttTaches.filter(t => t.projetId === projId);
  if (taches.length > 0) {
    ganttStart = getMonday(new Date(taches[0].dateDebut + 'T00:00:00'));
  } else {
    ganttStart = getMonday(new Date());
  }
  showPage('ganttprojet');
  renderGantt();
}

function ganttNav(w) { ganttStart = addDays(ganttStart, w*7); renderGantt(); }
function ganttNavToday() { ganttStart = getMonday(new Date()); renderGantt(); }

// ── Génération des colonnes selon l'échelle ─────────────────────
function buildGanttCols(scale) {
  // Retourne un tableau de {label, dateDebut, dateFin, isWE, width}
  const cols = [];
  if (scale === 'day') {
    for (let i = 0; i < GANTT_DAYS; i++) {
      const d = addDays(ganttStart, i);
      const ds = fmtISO(d);
      cols.push({ label: String(d.getDate()).padStart(2,'0'), labelSub: DAYS_FR[d.getDay()],
        dateDebut: ds, dateFin: ds, isWE: isWE(d), isToday: isToday(ds), width: 26 });
    }
  } else if (scale === 'week') {
    // 16 semaines
    for (let w = 0; w < 16; w++) {
      const weekStart = addDays(ganttStart, w * 7);
      const weekEnd = addDays(weekStart, 6);
      const ds = fmtISO(weekStart);
      const de = fmtISO(weekEnd);
      const containsToday = fmtISO(new Date()) >= ds && fmtISO(new Date()) <= de;
      cols.push({ label: 'S' + getWeekNum(weekStart),
        labelSub: weekStart.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}),
        dateDebut: ds, dateFin: de, isWE: false, isToday: containsToday, width: 56 });
    }
  } else { // month
    // 12 mois
    let cur = new Date(ganttStart.getFullYear(), ganttStart.getMonth(), 1);
    for (let m = 0; m < 12; m++) {
      const mStart = new Date(cur.getFullYear(), cur.getMonth(), 1);
      const mEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const ds = fmtISO(mStart); const de = fmtISO(mEnd);
      const todayM = new Date(); const containsToday = todayM >= mStart && todayM <= mEnd;
      cols.push({ label: MONTHS_FR[mStart.getMonth()],
        labelSub: String(mStart.getFullYear()).slice(2),
        dateDebut: ds, dateFin: de, isWE: false, isToday: containsToday, width: 72 });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }
  return cols;
}

function renderGantt() {
  if (!ganttProjId) return;
  const cols = buildGanttCols(ganttScale);
  const totalSpan = cols.reduce((s,col) => {
    if (!col.isWE) return s + (new Date(col.dateFin+'T00:00:00') - new Date(col.dateDebut+'T00:00:00'))/86400000 + 1;
    return s;
  }, 0);
  const firstDate = cols[0].dateDebut;
  const lastDate = cols[cols.length-1].dateFin;
  const end = new Date(lastDate+'T00:00:00');
  document.getElementById('ganttWeekLabel').textContent =
    new Date(firstDate+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'}) + ' — ' +
    end.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'});

  const COL_TASK = 200;
  const COL_DATE = 110;
  window._ganttCols = { TASK: COL_TASK, DATE: COL_DATE };

  // ── Groupes de mois pour la ligne de titre ──────────────────
  let mRow = `<tr class="month-hdr">
    <th style="position:sticky;left:0;z-index:21;background:var(--navy-dark);min-width:${COL_TASK}px;width:${COL_TASK}px"></th>
    <th style="position:sticky;left:${COL_TASK}px;z-index:21;background:var(--navy-dark);min-width:${COL_DATE}px;width:${COL_DATE}px"></th>
    <th style="position:sticky;left:${COL_TASK+COL_DATE}px;z-index:21;background:var(--navy-dark);min-width:${COL_DATE}px;width:${COL_DATE}px"></th>
    <th style="position:sticky;left:${COL_TASK+COL_DATE*2}px;z-index:21;background:var(--navy-dark);min-width:${COL_DATE+20}px;width:${COL_DATE+20}px"></th>`;
  if (ganttScale === 'day') {
    // Regrouper par mois
    const mb = monthBlocks(ganttStart, GANTT_DAYS);
    mb.forEach(b => { mRow += `<th colspan="${b.n}" style="text-align:center;padding:0 4px">${MONTHS_FR[b.m]} ${b.y}</th>`; });
  } else {
    // Pour semaine/mois, regrouper par année
    const years = {};
    cols.forEach(col => { const y = col.dateDebut.slice(0,4); years[y] = (years[y]||0)+1; });
    Object.entries(years).forEach(([y,n]) => { mRow += `<th colspan="${n}" style="text-align:center;padding:0 4px">${y}</th>`; });
  }
  mRow += '</tr>';

  // ── Ligne des colonnes dates ────────────────────────────────
  let dRow = `<tr>
    <th style="position:sticky;left:0;z-index:20;background:var(--navy);min-width:${COL_TASK}px;width:${COL_TASK}px;text-align:left;padding-left:12px;font-size:11px;font-weight:600;height:32px">Tâche</th>
    <th style="position:sticky;left:${COL_TASK}px;z-index:20;background:var(--navy);min-width:${COL_DATE}px;width:${COL_DATE}px;text-align:center;font-size:11px;padding:0 8px">Début</th>
    <th style="position:sticky;left:${COL_TASK+COL_DATE}px;z-index:20;background:var(--navy);min-width:${COL_DATE}px;width:${COL_DATE}px;text-align:center;font-size:11px;padding:0 8px">Fin</th>
    <th style="position:sticky;left:${COL_TASK+COL_DATE*2}px;z-index:20;background:var(--navy);min-width:${COL_DATE+20}px;width:${COL_DATE+20}px;text-align:center;font-size:11px;padding:0 8px">Jalon 🔶</th>`;
  cols.forEach(col => {
    const bgStyle = col.isWE ? 'background:var(--navy-dark)' : col.isToday ? 'background:var(--orange)' : '';
    dRow += `<th style="width:${col.width}px;min-width:${col.width}px;text-align:center;font-size:9px;padding:2px 1px;line-height:1.3;${bgStyle}">
      <div style="font-weight:600">${col.label}</div>
      <div style="opacity:.75;font-weight:400">${col.labelSub}</div>
    </th>`;
  });
  dRow += '</tr>';

  // ── Colgroup pour table-layout:fixed (alignement parfait head/body) ──
  const cg = [
    `<col style="width:${COL_TASK}px;min-width:${COL_TASK}px">`,
    `<col style="width:${COL_DATE}px;min-width:${COL_DATE}px">`,
    `<col style="width:${COL_DATE}px;min-width:${COL_DATE}px">`,
    `<col style="width:${COL_DATE+20}px;min-width:${COL_DATE+20}px">`
  ].concat(cols.map(c => `<col style="width:${c.width}px;min-width:${c.width}px">`));
  const colgroupHtml = '<colgroup>' + cg.join('') + '</colgroup>';

  const ganttTable = document.getElementById('ganttTable');
  ganttTable.style.tableLayout = 'fixed';
  ganttTable.querySelectorAll('colgroup').forEach(c => c.remove());
  ganttTable.insertAdjacentHTML('afterbegin', colgroupHtml);

  document.getElementById('ganttHead').innerHTML = mRow + dRow;

  // ── Body ────────────────────────────────────────────────────
  const taches = ganttTaches.filter(t => t.projetId === ganttProjId);
  let body = '';
  if (taches.length === 0) {
    body = `<tr><td colspan="100" style="text-align:center;padding:40px;color:var(--grey-500);font-size:13px">
      Aucune tâche — cliquez sur "+ Ajouter une tâche"
    </td></tr>`;
  } else {
    const fmtD = s => s ? new Date(s+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'numeric'}) : '—';
    taches.forEach(t => {
      let row = '<tr style="height:38px">';

      // Col Tâche (sticky)
      row += `<td onclick="openEditGanttTache(${t.id})" style="position:sticky;left:0;z-index:5;background:#fff;min-width:${COL_TASK}px;width:${COL_TASK}px;max-width:${COL_TASK}px;height:38px;padding:0 12px;border-right:1px solid var(--grey-200);font-size:12px;font-weight:500;color:var(--navy);vertical-align:middle;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer">${t.nom} <span style="color:var(--grey-400);font-size:10px">✏️</span></td>`;

      // Col Début (sticky, input date)
      row += `<td style="position:sticky;left:${COL_TASK}px;z-index:5;background:#fff;min-width:${COL_DATE}px;width:${COL_DATE}px;max-width:${COL_DATE}px;height:38px;padding:2px 6px;border-right:1px solid var(--grey-200);vertical-align:middle">
        <input type="date" value="${t.dateDebut||''}"
          onchange="updateGanttTache(${t.id},'dateDebut',this.value)"
          style="width:100%;height:30px;border:1px solid var(--grey-300);border-radius:4px;padding:2px 4px;font-size:11px;font-family:'DM Sans',sans-serif;color:var(--navy);background:#fff">
      </td>`;

      // Col Fin (sticky, input date)
      row += `<td style="position:sticky;left:${COL_TASK+COL_DATE}px;z-index:5;background:#fff;min-width:${COL_DATE}px;width:${COL_DATE}px;max-width:${COL_DATE}px;height:38px;padding:2px 6px;border-right:1px solid var(--grey-200);vertical-align:middle">
        <input type="date" value="${t.dateFin||''}"
          onchange="updateGanttTache(${t.id},'dateFin',this.value)"
          style="width:100%;height:30px;border:1px solid var(--grey-300);border-radius:4px;padding:2px 4px;font-size:11px;font-family:'DM Sans',sans-serif;color:var(--navy);background:#fff">
      </td>`;

      // Col Jalon (sticky, input date + bouton suppr)
      row += `<td style="position:sticky;left:${COL_TASK+COL_DATE*2}px;z-index:5;background:#fff;min-width:${COL_DATE+20}px;width:${COL_DATE+20}px;max-width:${COL_DATE+20}px;height:38px;padding:2px 6px;border-right:2px solid var(--grey-300);vertical-align:middle">
        <div style="display:flex;align-items:center;gap:4px">
          <input type="date" value="${t.jalon||''}"
            onchange="updateGanttTache(${t.id},'jalon',this.value||null)"
            style="flex:1;height:30px;border:1px solid ${t.jalon?'var(--orange)':'var(--grey-300)'};border-radius:4px;padding:2px 4px;font-size:11px;font-family:'DM Sans',sans-serif;color:${t.jalon?'var(--orange)':'var(--grey-600)'};background:#fff">
          <span onclick="deleteGanttTacheById(${t.id})" title="Supprimer" style="cursor:pointer;color:var(--grey-400);font-size:16px;line-height:1;padding:0 2px">×</span>
        </div>
      </td>`;

      // Colonnes de la grille Gantt
      cols.forEach(col => {
        const we = col.isWE;
        let bg = we ? '#d0d5db' : '#fff';
        let content = '';

        if (!we && t.dateDebut && t.dateFin) {
          // Calculer l'overlap de la tâche avec cette colonne
          const colStart = col.dateDebut;
          const colEnd = col.dateFin;
          const tStart = t.dateDebut;
          const tEnd = t.dateFin;

          // Est-ce que la tâche couvre cette colonne ?
          const overlapStart = tStart <= colEnd && tEnd >= colStart;
          const isJalonCol = t.jalon && t.jalon >= colStart && t.jalon <= colEnd;

          if (isJalonCol && ganttScale !== 'day') {
            // Jalon dans cette période
            bg = 'rgba(240,120,0,0.15)';
            content = '<span style="font-size:12px">◆</span>';
          } else if (isJalonCol && ganttScale === 'day') {
            bg = 'var(--orange)';
            content = '<span style="color:#fff;font-size:11px;font-weight:700">◆</span>';
          } else if (overlapStart) {
            // Calcul pour la barre Gantt
            if (ganttScale === 'day') {
              // Jour exact → barre pleine
              bg = 'rgba(26,58,92,0.1)';
              // Barre bleue
              const isStart = tStart === colStart;
              const isEnd = tEnd === colEnd;
              const leftRadius = isStart ? '4px' : '0';
              const rightRadius = isEnd ? '4px' : '0';
              content = `<div style="position:absolute;left:${isStart?'3px':'0'};right:${isEnd?'3px':'0'};top:50%;transform:translateY(-50%);height:14px;background:rgba(26,58,92,0.85);border-radius:${leftRadius} ${rightRadius} ${rightRadius} ${leftRadius}"></div>`;
              bg = '#fff';
            } else {
              // Semaine/Mois : calculer la proportion couverte
              const cS = new Date(colStart+'T00:00:00');
              const cE = new Date(colEnd+'T00:00:00');
              const tS = new Date(tStart+'T00:00:00');
              const tE = new Date(tEnd+'T00:00:00');
              const overlapS = tS > cS ? tS : cS;
              const overlapE = tE < cE ? tE : cE;
              const colDays = (cE - cS) / 86400000 + 1;
              const overDays = (overlapE - overlapS) / 86400000 + 1;
              const pct = Math.min(100, Math.round(overDays / colDays * 100));
              const leftPct = tS > cS ? 0 : Math.round((cS - tS) / 86400000 / colDays * 100);
              // Barre proportionnelle
              const barLeft = tS <= cS ? '0%' : Math.round((tS-cS)/86400000/colDays*100)+'%';
              const barRight = tE >= cE ? '0%' : Math.round((cE-tE)/86400000/colDays*100)+'%';
              const isStart2 = tS > cS;
              const isEnd2 = tE < cE;
              content = `<div style="position:absolute;left:${barLeft};right:${barRight};top:50%;transform:translateY(-50%);height:14px;background:rgba(26,58,92,0.85);border-radius:${isStart2?'4px':'0'} ${isEnd2?'4px':'0'} ${isEnd2?'4px':'0'} ${isStart2?'4px':'0'}"></div>`;
              bg = '#fff';
            }
          }
        }

        const todayShadow = col.isToday && ganttScale === 'day' ? 'box-shadow:inset 0 0 0 1px rgba(240,120,0,.4);' : '';
        row += `<td style="width:${col.width}px;min-width:${col.width}px;max-width:${col.width}px;text-align:center;vertical-align:middle;border-right:1px solid var(--grey-200);background:${bg};${todayShadow}position:relative">${content}</td>`;
      });

      row += '</tr>';
      body += row;
    });
  }
  document.getElementById('ganttBody').innerHTML = body;
}

function openAddGanttTache() {
  curGanttTacheId = null;
  document.getElementById('ganttTacheMTitle').textContent = 'Ajouter une tâche';
  document.getElementById('ganttTacheMSub').textContent = projets.find(p=>p.id===ganttProjId)?.Nom||'';
  document.getElementById('gtNom').value = '';
  document.getElementById('gtDebut').value = '';
  document.getElementById('gtFin').value = '';
  document.getElementById('gtJalon').value = '';
  document.getElementById('gtDelBtn').style.display = 'none';
  openOverlay('ganttTacheOverlay');
  setTimeout(() => document.getElementById('gtNom').focus(), 120);
}

function openEditGanttTache(id) {
  curGanttTacheId = id;
  const t = ganttTaches.find(x => x.id === id);
  document.getElementById('ganttTacheMTitle').textContent = 'Modifier la tâche';
  document.getElementById('ganttTacheMSub').textContent = t.nom;
  document.getElementById('gtNom').value = t.nom;
  document.getElementById('gtDebut').value = t.dateDebut;
  document.getElementById('gtFin').value = t.dateFin;
  document.getElementById('gtJalon').value = t.jalon || '';
  document.getElementById('gtDelBtn').style.display = 'inline-flex';
  openOverlay('ganttTacheOverlay');
}

function updateGanttTache(id, field, value) {
  const i = ganttTaches.findIndex(t => t.id === id);
  if (i < 0) return;
  ganttTaches[i][field] = value || null;
  if (ganttTaches[i].dateDebut && ganttTaches[i].dateFin &&
      ganttTaches[i].dateDebut > ganttTaches[i].dateFin) {
    showToast('Attention : la fin est avant le début', 'err');
  }
  renderGantt();
  if (currentProjId === ganttProjId) renderPP();
saveAllData();
}

function deleteGanttTacheById(id) {
  if (!confirm('Supprimer cette tâche ?')) return;
  ganttTaches = ganttTaches.filter(t => t.id !== id);
  const lignesToDel = lignesProjets.filter(l => l.tacheGanttId === id).map(l => l.id);
  lignesProjets = lignesProjets.filter(l => l.tacheGanttId !== id);
  heuresProjets = heuresProjets.filter(h => !lignesToDel.includes(h.ligneId));
  renderGantt();
  saveAllData();
  showToast('Tâche supprimée', 'ok');
}

function saveGanttTache() {
  const nom = document.getElementById('gtNom').value.trim();
  const debut = document.getElementById('gtDebut').value;
  const fin = document.getElementById('gtFin').value;
  const jalon = document.getElementById('gtJalon').value || null;
  if (!nom || !debut || !fin) { showToast('Nom, début et fin requis', 'err'); return; }
  if (debut > fin) { showToast('La fin doit être après le début', 'err'); return; }
  if (curGanttTacheId) {
    const i = ganttTaches.findIndex(t => t.id === curGanttTacheId);
    ganttTaches[i] = { ...ganttTaches[i], nom, dateDebut: debut, dateFin: fin, jalon };
  } else {
    const newId = nextId++;
    const newTache={ id: newId, projetId: ganttProjId, nom, dateDebut: debut, dateFin: fin, jalon };
    ganttTaches.push(newTache);
  }
  saveAllData();
  showToast('Enregistré', 'ok');
  closeOverlay('ganttTacheOverlay');
  renderGantt();
}

function deleteGanttTache() {
  if (!curGanttTacheId) return;
  if (!confirm('Supprimer cette tâche ? Les lignes de planification associées seront également supprimées.')) return;
  ganttTaches = ganttTaches.filter(t => t.id !== curGanttTacheId);
  const lignesToDel = lignesProjets.filter(l => l.tacheGanttId === curGanttTacheId).map(l => l.id);
  lignesProjets = lignesProjets.filter(l => l.tacheGanttId !== curGanttTacheId);
  heuresProjets = heuresProjets.filter(h => !lignesToDel.includes(h.ligneId));
  saveAllData();
  closeOverlay('ganttTacheOverlay');
  renderGantt();
  showToast('Tâche supprimée', 'ok');
}

function exportGanttPDF() {
  // Modale choix d'échelle
  const existing = document.getElementById('ganttPdfModal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'ganttPdfModal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:9999;display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:#fff;border-radius:12px;padding:28px 32px;min-width:320px;box-shadow:0 8px 32px rgba(0,0,0,.18)">
      <div style="font-size:15px;font-weight:700;color:var(--navy);margin-bottom:6px">📄 Export PDF Gantt</div>
      <div style="font-size:12px;color:var(--grey-500);margin-bottom:20px">Choisissez l'échelle de temps</div>
      <div style="display:flex;gap:10px;margin-bottom:20px">
        <button onclick="doExportGanttPDF('week');document.getElementById('ganttPdfModal').remove()"
          style="flex:1;padding:14px 10px;border:2px solid var(--navy);border-radius:8px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:var(--navy)">
          📅 Hebdomadaire<br><span style="font-size:10px;font-weight:400;color:var(--grey-500)">3–6 mois</span>
        </button>
        <button onclick="doExportGanttPDF('month');document.getElementById('ganttPdfModal').remove()"
          style="flex:1;padding:14px 10px;border:2px solid var(--navy);border-radius:8px;background:#fff;cursor:pointer;font-size:13px;font-weight:600;color:var(--navy)">
          🗓️ Mensuel<br><span style="font-size:10px;font-weight:400;color:var(--grey-500)">1–2 ans</span>
        </button>
      </div>
      <button onclick="document.getElementById('ganttPdfModal').remove()"
        style="width:100%;padding:8px;border:1px solid var(--grey-200);border-radius:6px;background:#fff;cursor:pointer;font-size:12px;color:var(--grey-500)">Annuler</button>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
}

function doExportGanttPDF(scale) {
  const { jsPDF } = window.jspdf;
  const p = projets.find(x => x.id === ganttProjId);
  if (!p) { showToast('Aucun projet sélectionné','err'); return; }
  const taches = ganttTaches.filter(t => t.projetId === ganttProjId);
  if (!taches.length) { showToast('Aucune tâche à exporter','err'); return; }

  // ── Plage de dates ──
  const allDates = taches.flatMap(t => [t.dateDebut, t.dateFin, t.jalon].filter(Boolean));
  const pStart = allDates.reduce((a,b) => a < b ? a : b);
  const pEnd   = allDates.reduce((a,b) => a > b ? a : b);

  let cursorDate = scale === 'week'
    ? getMonday(new Date(pStart+'T00:00:00'))
    : new Date(new Date(pStart+'T00:00:00').getFullYear(), new Date(pStart+'T00:00:00').getMonth(), 1);

  // ── Colonnes ──
  const cols = [];
  const pEndDate = new Date(pEnd+'T00:00:00');
  while (true) {
    if (scale === 'week') {
      const wEnd = addDays(cursorDate, 6);
      cols.push({ label:'S'+getWeekNum(cursorDate),
        labelSub: cursorDate.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}),
        dateDebut: fmtISO(cursorDate), dateFin: fmtISO(wEnd) });
      cursorDate = addDays(cursorDate, 7);
      if (cursorDate > addDays(pEndDate, 7)) break;
    } else {
      const mEnd = new Date(cursorDate.getFullYear(), cursorDate.getMonth()+1, 0);
      cols.push({ label: MONTHS_FR[cursorDate.getMonth()],
        labelSub: String(cursorDate.getFullYear()),
        dateDebut: fmtISO(new Date(cursorDate.getFullYear(), cursorDate.getMonth(), 1)),
        dateFin:   fmtISO(mEnd) });
      cursorDate = new Date(cursorDate.getFullYear(), cursorDate.getMonth()+1, 1);
      if (cursorDate > new Date(pEndDate.getFullYear(), pEndDate.getMonth()+1, 1)) break;
    }
  }

  // ── Dimensions ──
  const margin   = 8;
  const hdrH     = 16;
  const thH      = 18;
  const COL_TASK = 52, COL_DBT = 22, COL_FIN = 22, COL_JAL = 22;
  const fixedW   = COL_TASK + COL_DBT + COL_FIN + COL_JAL;
  const colW     = scale === 'week' ? 14 : 20;
  const ROW_H    = 8;
  const FONT_SM  = 6.5;

  // Largeur page = sur-mesure (contenu exact)
  const pgW    = fixedW + cols.length * colW;
  const pageW  = margin * 2 + pgW;

  // Hauteur page = A3 paysage minimum (420mm), paginer si dépassement
  const A3_H       = 420; // mm, A3 paysage hauteur
  const availBodyH = A3_H - hdrH - thH - margin * 2;
  const rowsPerPage = Math.floor(availBodyH / ROW_H);
  const pageH       = A3_H;

  // Découpage vertical en pages
  const rowGroups = [];
  for (let i = 0; i < taches.length; i += rowsPerPage)
    rowGroups.push(taches.slice(i, i + rowsPerPage));
  const totalPages = rowGroups.length;

  const pdf = new jsPDF({ orientation:'landscape', unit:'mm', format:[pageW, pageH] });

  // Couleurs
  const NAVY=[26,58,92], NAVY_D=[18,40,65], GREY_L=[230,234,240],
        GREY_B=[180,190,205], WHITE=[255,255,255], ORANGE=[240,120,0];

  const fmtShort = s => s
    ? new Date(s+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit',year:'2-digit'})
    : '—';
  const scaleLabel = scale==='week' ? 'hebdomadaire' : 'mensuelle';

  // dateToX
  const d2x = (ds, clamp) => {
    if (!ds) return null;
    for (let i=0; i<cols.length; i++) {
      const c = cols[i];
      if (ds >= c.dateDebut && ds <= c.dateFin) {
        const tot = (new Date(c.dateFin+'T00:00:00')-new Date(c.dateDebut+'T00:00:00'))/86400000+1;
        const off = (new Date(ds+'T00:00:00')-new Date(c.dateDebut+'T00:00:00'))/86400000;
        return margin+fixedW+i*colW+(off/tot)*colW;
      }
    }
    if (!clamp) return null;
    if (ds < cols[0].dateDebut) return margin+fixedW;
    return margin+fixedW+cols.length*colW;
  };

  function drawHeader(pgNum) {
    pdf.setFillColor(...NAVY); pdf.rect(0,0,pageW,hdrH,'F');
    pdf.setTextColor(...WHITE);
    pdf.setFontSize(11); pdf.setFont('helvetica','bold');
    pdf.text('Gantt — '+p.Nom, margin, 10);
    pdf.setFontSize(8); pdf.setFont('helvetica','normal');
    pdf.text((p.Commande||'')+' · '+(p.Client||'')+' · '+(p.Entite||''), margin, 14);
    pdf.text('GEIE AE — '+new Date().toLocaleDateString('fr-FR')+' · Échelle '+scaleLabel+
      (totalPages>1 ? ' · Page '+pgNum+'/'+totalPages : ''), pageW-margin, 12, {align:'right'});
  }

  function drawThead(Y) {
    // Ligne 1 : années
    pdf.setFillColor(...NAVY_D); pdf.rect(margin,Y,pgW,thH/2,'F');
    const ygs = [];
    cols.forEach((c,i) => {
      const y = c.dateDebut.slice(0,4);
      if (!ygs.length || ygs[ygs.length-1].year!==y) ygs.push({year:y,count:1,si:i});
      else ygs[ygs.length-1].count++;
    });
    pdf.setTextColor(...WHITE); pdf.setFontSize(6.5); pdf.setFont('helvetica','bold');
    ygs.forEach(g => pdf.text(g.year, margin+fixedW+g.si*colW+g.count*colW/2, Y+thH/4+1.5, {align:'center'}));

    // Ligne 2 : labels
    const Y2 = Y+thH/2;
    pdf.setFillColor(...NAVY); pdf.rect(margin,Y2,pgW,thH/2,'F');
    pdf.setTextColor(...WHITE); pdf.setFontSize(6); pdf.setFont('helvetica','bold');
    [{l:'Tâche',w:COL_TASK,x:margin},{l:'Début',w:COL_DBT,x:margin+COL_TASK},
     {l:'Fin',w:COL_FIN,x:margin+COL_TASK+COL_DBT},{l:'Jalon',w:COL_JAL,x:margin+COL_TASK+COL_DBT+COL_FIN}
    ].forEach(f => pdf.text(f.l, f.x+f.w/2, Y2+thH/4+1.5, {align:'center'}));
    pdf.setFontSize(5.5); pdf.setFont('helvetica','normal');
    cols.forEach((c,i) => {
      const cx = margin+fixedW+i*colW+colW/2;
      pdf.text(c.label, cx, Y2+2.5, {align:'center'});
      pdf.text(c.labelSub, cx, Y2+5.5, {align:'center'});
    });
    pdf.setDrawColor(...GREY_B); pdf.setLineWidth(0.1);
    for (let i=0; i<=cols.length; i++) pdf.line(margin+fixedW+i*colW, Y2, margin+fixedW+i*colW, Y2+thH/2);
    [COL_TASK,COL_DBT,COL_FIN,COL_JAL].reduce((acc,w) => { pdf.line(margin+acc,Y2,margin+acc,Y2+thH/2); return acc+w; },0);
    return Y2+thH/2;
  }

  function drawRows(rowGroup, bodyTop, globalOffset) {
    const grpH = rowGroup.length * ROW_H;
    rowGroup.forEach((t, li) => {
      const idx  = globalOffset + li;
      const rowY = bodyTop + li*ROW_H;
      pdf.setFillColor(...(idx%2===0 ? WHITE : [245,247,250]));
      pdf.rect(margin, rowY, pgW, ROW_H, 'F');
      pdf.setDrawColor(...GREY_L); pdf.setLineWidth(0.1);
      pdf.line(margin, rowY+ROW_H, margin+pgW, rowY+ROW_H);

      const tY = rowY+ROW_H/2+FONT_SM*0.35;
      pdf.setFontSize(FONT_SM); pdf.setFont('helvetica','normal');
      pdf.setTextColor(...NAVY);
      pdf.text(pdf.splitTextToSize(t.nom, COL_TASK-4)[0], margin+2, tY);
      pdf.setTextColor(60,80,110);
      pdf.text(fmtShort(t.dateDebut), margin+COL_TASK+COL_DBT/2,         tY, {align:'center'});
      pdf.text(fmtShort(t.dateFin),   margin+COL_TASK+COL_DBT+COL_FIN/2, tY, {align:'center'});
      if (t.jalon) {
        pdf.setTextColor(...ORANGE);
        pdf.text(fmtShort(t.jalon), margin+COL_TASK+COL_DBT+COL_FIN+COL_JAL/2, tY, {align:'center'});
      }
      pdf.setDrawColor(...GREY_L);
      [COL_TASK,COL_DBT,COL_FIN].reduce((acc,w) => { pdf.line(margin+acc,rowY,margin+acc,rowY+ROW_H); return acc+w; },0);
      pdf.line(margin+fixedW, rowY, margin+fixedW, rowY+ROW_H);

      // Barre
      if (t.dateDebut && t.dateFin) {
        const x1=d2x(t.dateDebut,true), x2=d2x(t.dateFin,true);
        if (x1!==null && x2!==null && x2>x1) {
          const bH=ROW_H*0.55, bY=rowY+(ROW_H-bH)/2;
          pdf.setFillColor(...NAVY);
          pdf.roundedRect(x1, bY, x2-x1, bH, 1, 1, 'F');
        }
      }
      // Jalon
      if (t.jalon) {
        const xJ=d2x(t.jalon,false);
        if (xJ!==null) {
          const s=ROW_H*0.38;
          pdf.setFillColor(...ORANGE);
          pdf.lines([[s,0],[0,s],[-s,0],[0,-s]], xJ, rowY+ROW_H/2-s/2+ROW_H*0.1, [1,1], 'F');
        }
      }
      pdf.setDrawColor(...GREY_L);
      for (let i=1; i<cols.length; i++) pdf.line(margin+fixedW+i*colW, rowY, margin+fixedW+i*colW, rowY+ROW_H);
    });
    // Bordures
    pdf.setDrawColor(...GREY_B); pdf.setLineWidth(0.2);
    pdf.rect(margin, bodyTop, pgW, grpH);
    pdf.setDrawColor(...NAVY_D); pdf.setLineWidth(0.4);
    pdf.line(margin+fixedW, bodyTop-thH, margin+fixedW, bodyTop+grpH);
  }

  // ── Rendu ──
  rowGroups.forEach((rowGroup, pi) => {
    if (pi > 0) pdf.addPage([pageW, pageH]);
    drawHeader(pi+1);
    const bodyTop = drawThead(hdrH+margin);
    drawRows(rowGroup, bodyTop, pi*rowsPerPage);
  });

  pdf.save('gantt_'+(p.Nom||'projet').replace(/[^a-z0-9]/gi,'_')+'_'+scale+'.pdf');
  showToast('PDF Gantt exporté'+(totalPages>1?' — '+totalPages+' pages':'')+' !', 'ok');
}
