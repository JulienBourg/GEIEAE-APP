// ═══════════════════════════════════════════════════════════════
// PLANNING PROJET
// ═══════════════════════════════════════════════════════════════
let currentProjId = null;
let ppStart = getMonday(new Date());
const PP_DAYS = 28;
let curLigneId = null;
let curPPHContext = null; // {ligneId, date}
let pendingPPHData = null; // pour forcer après alerte surcharge

function openPlanProjet(projId) {
  currentProjId = projId;
  const p = projets.find(x => x.id === projId);
  document.getElementById('planProjTitle').textContent = '⚙️ ' + p.Nom;
  document.getElementById('planProjSub').textContent =
    p.Commande + ' — ' + p.Client + ' — ' + p.Entite;
  showPage('planprojet');
  ppStart = getMonday(new Date());
  renderPP();
}

function ppNav(w) { ppStart = addDays(ppStart, w * 7); renderPP(); }
function ppToday() { ppStart = getMonday(new Date()); renderPP(); }

function renderPP() {
  if (!currentProjId) return;
  const end = addDays(ppStart, PP_DAYS - 1);
  document.getElementById('ppWeekLabel').textContent =
    ppStart.toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'}) +
    ' — ' + end.toLocaleDateString('fr-FR', {day:'2-digit',month:'short',year:'numeric'});

  // Construire le header directement (2 cols fixes : Tâche + Ressource, puis les jours)
  const dates = [];
  for (let i = 0; i < PP_DAYS; i++) dates.push(addDays(ppStart, i));

  const mb = monthBlocks(ppStart, PP_DAYS);
  // Ligne mois : 2 cols fixes + blocs mois
  let mRow = '<tr class="month-hdr">' +
    '<th class="col-ressource" style="min-width:160px;width:160px"></th>' +
    '<th style="position:sticky;left:160px;z-index:21;background:var(--navy-dark);min-width:160px;width:160px"></th>';
  mb.forEach(b => { mRow += `<th colspan="${b.n}" style="text-align:center;padding:0 6px">${MONTHS_FR[b.m]} ${b.y}</th>`; });
  mRow += '</tr>';

  // Ligne jours : 2 cols fixes + un th par jour
  let dRow = '<tr>' +
    '<th class="col-ressource" style="min-width:160px;width:160px;position:sticky;left:0;z-index:20;background:var(--navy);text-align:left;padding-left:12px;font-size:11px;font-weight:600;height:32px">Tâche</th>' +
    '<th style="position:sticky;left:160px;z-index:20;background:var(--navy);min-width:160px;width:160px;padding:0 10px;font-size:11px;font-weight:600;white-space:nowrap">Ressource</th>';
  dates.forEach(d => {
    const ds = fmtISO(d);
    const we = isWE(d); const td = isToday(ds);
    const cls = we ? 'col-day we' : td ? 'col-day today-h' : 'col-day';
    dRow += `<th class="${cls}">${DAYS_FR[d.getDay()]}<br><span style="font-weight:400;opacity:.8;font-size:10px">${String(d.getDate()).padStart(2,'0')}</span></th>`;
  });
  dRow += '</tr>';
  // Colgroup identique dans les deux tables pour forcer table-layout:fixed
  const ppCols = [
    '<col style="width:160px;min-width:160px">',
    '<col style="width:160px;min-width:160px">'
  ].concat(dates.map(() => '<col style="width:48px;min-width:48px">'));
  const colgroupHtml = '<colgroup>' + ppCols.join('') + '</colgroup>';

  document.getElementById('ppHeadTable').style.tableLayout = 'fixed';
  document.getElementById('ppTable').style.tableLayout = 'fixed';
  document.getElementById('ppHead').innerHTML = mRow + dRow;
  // Injecter colgroup dans les deux tables
  const ppHeadTbl = document.getElementById('ppHeadTable');
  const ppBodyTbl = document.getElementById('ppTable');
  ppHeadTbl.querySelectorAll('colgroup').forEach(c => c.remove());
  ppBodyTbl.querySelectorAll('colgroup').forEach(c => c.remove());
  ppHeadTbl.insertAdjacentHTML('afterbegin', colgroupHtml);
  ppBodyTbl.insertAdjacentHTML('afterbegin', colgroupHtml);

  const lignes = lignesProjets.filter(l => l.projetId === currentProjId);

  let html = lignes.map(l => {
    const tache = ganttTaches.find(t => t.id === l.tacheGanttId);
    const tacheNom = tache ? tache.nom : '?';
    const tacheDebut = tache ? tache.dateDebut : null;
    const tacheFin = tache ? tache.dateFin : null;
    const tacheJalon = tache ? tache.jalon : null;

    let row = `<tr>`;
    // Tâche cell (sticky left) — affiche nom depuis Gantt
    row += `<td style="position:sticky;left:0;z-index:5;background:#fff;min-width:160px;width:160px;height:36px;padding:0 12px;border-right:1px solid var(--grey-200);font-size:12px;font-weight:500;color:var(--navy);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer" onclick="openEditLigneModal(${l.id})" title="Cliquer pour modifier/supprimer cette ligne">${tacheNom} <span style="color:var(--grey-400);font-size:10px">✏️</span></td>`;
    // Ressource cell
    row += `<td style="position:sticky;left:160px;z-index:5;background:#fff;min-width:160px;width:160px;height:36px;padding:0 10px;border-right:2px solid var(--grey-200);font-size:11px;color:var(--grey-600);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${l.ressource}</td>`;

    dates.forEach(d => {
      const ds = fmtISO(d);
      const rscObj = ressources.find(r => rscName(r) === l.ressource);
      const pays = rscObj ? (rscObj.Pays||'France') : 'France';
      const we = isWE(d); const ferie = isFerie(ds, pays); const td = isToday(ds);
      if (we) { row += `<td class="td-cell we"></td>`; return; }
      if (ferie) { row += `<td class="td-cell ferie" title="${ferie.Libelle}">🎌</td>`; return; }

      // Zone verte = dans la période de la tâche Gantt
      const inGanttRange = tacheDebut && tacheFin && ds >= tacheDebut && ds <= tacheFin;
      // Jalon contractuel
      const isJalonDay = tacheJalon && ds === tacheJalon;

      const h = heuresProjets.find(x => x.ligneId === l.id && x.date === ds);
      let bg = 'background:#fff;';
      if (isJalonDay) bg = 'background:rgba(240,120,0,0.15);box-shadow:inset 2px 0 0 var(--orange),inset -2px 0 0 var(--orange);';
      else if (inGanttRange) bg = 'background:rgba(26,122,74,0.18);';
      const todayShadow = td ? 'box-shadow:inset 0 0 0 1px rgba(240,120,0,.4);' : '';

      if (h && h.heures > 0) {
        row += `<td class="td-cell" style="${bg}${todayShadow}" id="pp_${l.id}_${ds}" onclick="openPPH(${l.id},'${ds}','pp_${l.id}_${ds}')">
          <span class="chip chip-heures" style="pointer-events:none">${h.heures}</span>
          ${isJalonDay ? '<span style="position:absolute;top:2px;right:2px;font-size:8px;pointer-events:none">🔶</span>' : ''}
        </td>`;
      } else {
        const jalIcon = isJalonDay ? '<span style="font-size:10px;pointer-events:none">🔶</span>' : '';
        row += `<td class="td-cell" style="${bg}${todayShadow};position:relative" id="pp_${l.id}_${ds}" onclick="openPPH(${l.id},'${ds}','pp_${l.id}_${ds}')">${jalIcon}</td>`;
      }
    });
    row += `</tr>`;
    return row;
  }).join('');

  // Total row
  if (lignes.length > 0) {
    let totRow = `<tr style="background:var(--navy-dark)">
      <td style="position:sticky;left:0;z-index:5;background:var(--navy-dark);min-width:160px;width:160px;height:36px;padding:0 12px;font-size:11px;font-weight:700;color:#fff">TOTAL</td>
      <td style="position:sticky;left:160px;z-index:5;background:var(--navy-dark);min-width:160px;width:160px;border-right:2px solid rgba(255,255,255,.2)"></td>`;
    dates.forEach(d => {
      const ds = fmtISO(d);
      if (isWE(d)) { totRow += `<td style="background:var(--navy-dark);border-right:1px solid rgba(255,255,255,.1)"></td>`; return; }
      const tot = heuresProjets.filter(x => x.projetId === currentProjId && x.date === ds)
        .reduce((s, x) => s + x.heures, 0);
      totRow += `<td style="background:var(--navy-dark);text-align:center;border-right:1px solid rgba(255,255,255,.1);font-family:'DM Mono',monospace;font-size:11px;font-weight:600;color:${tot>0?'#fff':'rgba(255,255,255,.2)'}">${tot>0?tot:''}</td>`;
    });
    totRow += `</tr>`;
    html += totRow;
  }

  if (lignes.length === 0) {
    html = `<tr><td colspan="100" style="text-align:center;padding:40px;color:var(--grey-500);font-size:13px">
      Aucune ligne — cliquez sur "+ Ajouter une ligne" pour commencer
    </td></tr>`;
  }

  document.getElementById('ppBody').innerHTML = html;
  setTimeout(()=>syncHeadWidth('pp'),0);
}

// ── Ajouter / modifier une ligne ────────────────────────────────
function openAddLigneModal() {
  curLigneId = null;
  document.getElementById('addLigneMTitle').textContent = 'Ajouter une ligne';
  document.getElementById('addLigneMSub').textContent = projets.find(p=>p.id===currentProjId)?.Nom||'';
  document.getElementById('delLigneBtn').style.display = 'none';
  // Dropdown tâches depuis Gantt
  const taches = ganttTaches.filter(t => t.projetId === currentProjId);
  const selTask = document.getElementById('ligneTask');
  selTask.innerHTML = taches.length > 0
    ? taches.map(t => `<option value="${t.id}">${t.nom}</option>`).join('')
    : '<option value="">Aucune tâche Gantt — créez d&#39;abord un Gantt</option>';
  const sel = document.getElementById('ligneRsc');
  sel.innerHTML = ressources.map(r => `<option value="${rscName(r)}">${rscName(r)}</option>`).join('');
  openOverlay('addLigneOverlay');
}

function openEditLigneModal(ligneId) {
  curLigneId = ligneId;
  const l = lignesProjets.find(x => x.id === ligneId);
  const t = ganttTaches.find(x => x.id === l.tacheGanttId);
  document.getElementById('addLigneMTitle').textContent = 'Modifier la ligne';
  document.getElementById('addLigneMSub').textContent = (t ? t.nom : '?') + ' — ' + l.ressource;
  document.getElementById('delLigneBtn').style.display = 'inline-flex';
  const taches = ganttTaches.filter(t => t.projetId === currentProjId);
  const selTask = document.getElementById('ligneTask');
  selTask.innerHTML = taches.map(t => `<option value="${t.id}" ${t.id===l.tacheGanttId?'selected':''}>${t.nom}</option>`).join('');
  const sel = document.getElementById('ligneRsc');
  sel.innerHTML = ressources.map(r => `<option value="${rscName(r)}" ${rscName(r)===l.ressource?'selected':''}>${rscName(r)}</option>`).join('');
  openOverlay('addLigneOverlay');
}

function saveLigne() {
  const tacheId = parseInt(document.getElementById('ligneTask').value);
  const rsc = document.getElementById('ligneRsc').value;
  if (!tacheId) { showToast('Sélectionner une tâche', 'err'); return; }
  if (curLigneId) {
    const i = lignesProjets.findIndex(l => l.id === curLigneId);
    lignesProjets[i] = { ...lignesProjets[i], tacheGanttId: tacheId, ressource: rsc };
  } else {
    // Vérifier doublons tâche+ressource
    const exists = lignesProjets.find(l => l.projetId===currentProjId && l.tacheGanttId===tacheId && l.ressource===rsc);
    if (exists) { showToast('Cette combinaison tâche/ressource existe déjà', 'err'); return; }
    const nl={ id: nextId++, projetId: currentProjId, tacheGanttId: tacheId, ressource: rsc };
    lignesProjets.push(nl);
  }
  saveAllData();
  showToast('Enregistré', 'ok');
  closeOverlay('addLigneOverlay');
  renderPP();
}

function deleteLigne() {
  if (!curLigneId) return;
  if (!confirm('Supprimer cette ligne et toutes ses heures ?')) return;
  lignesProjets = lignesProjets.filter(l => l.id !== curLigneId);
  heuresProjets = heuresProjets.filter(h => h.ligneId !== curLigneId);
  saveAllData();
  closeOverlay('addLigneOverlay');
  renderPP();
  showToast('Ligne supprimée', 'ok');
}

// ── Saisie INLINE dans la cellule ───────────────────────────────
function openPPH(ligneId, date, cellId) {
  const td = document.getElementById(cellId);
  if (!td) return;
  // Fermer tout input ouvert
  closePPHInput();
  const h = heuresProjets.find(x => x.ligneId === ligneId && x.date === date);
  const val = h ? h.heures : '';
  td.innerHTML = `<input type="number"
    id="ppInlineInput"
    value="${val}"
    min="0" max="24" step="0.5"
    style="width:42px;height:28px;border:2px solid var(--navy-light);border-radius:4px;
           text-align:center;font-family:'DM Mono',monospace;font-size:12px;
           font-weight:600;background:#fff;color:var(--navy);padding:0 2px"
    data-ligne="${ligneId}" data-date="${date}"
    onblur="commitPPH(this)"
    onkeydown="handlePPHKey(event, this, ${ligneId}, '${date}', '${val}')"
  >`;
  const inp = document.getElementById('ppInlineInput');
  inp.focus(); inp.select();
}

function handlePPHKey(e, inp, ligneId, date, oldVal) {
  if (e.key === 'Enter') { e.preventDefault(); inp.blur(); return; }
  if (e.key === 'Escape') { cancelPPH(inp, oldVal); return; }

  const isRight = e.key === 'ArrowRight';
  const isLeft  = e.key === 'ArrowLeft';
  const isDown  = e.key === 'ArrowDown';
  const isUp    = e.key === 'ArrowUp';
  if (!isRight && !isLeft && !isDown && !isUp) return;
  e.preventDefault();

  inp.blur(); // commit d'abord

  const allCells = Array.from(document.querySelectorAll('#ppBody td.td-cell[id^="pp_"]'));
  const curId = 'pp_' + ligneId + '_' + date;

  if (isRight || isLeft) {
    // Même ligne (ligneId), date suivante/précédente
    const sameLineCells = allCells.filter(td => td.id.startsWith('pp_' + ligneId + '_'));
    const idx = sameLineCells.findIndex(td => td.id === curId);
    const next = sameLineCells[idx + (isRight ? 1 : -1)];
    if (next && next.onclick) next.click();
  } else {
    // Même date, ligne suivante/précédente
    const sameDateCells = allCells.filter(td => td.id.endsWith('_' + date));
    const idx = sameDateCells.findIndex(td => td.id === curId);
    const next = sameDateCells[idx + (isDown ? 1 : -1)];
    if (next && next.onclick) next.click();
  }
}

function commitPPH(inp) {
  const ligneId = parseInt(inp.dataset.ligne);
  const date = inp.dataset.date;
  const heures = parseFloat(inp.value);
  if (!inp.value || heures <= 0) {
    const idx = heuresProjets.findIndex(x => x.ligneId === ligneId && x.date === date);
    if (idx >= 0) heuresProjets.splice(idx, 1);
    saveAllData();
    renderPP();
    return;
  }
  // ── Vérifier surcharge — total journée hors ligne courante ──
  const ligne = lignesProjets.find(l => l.id === ligneId);
  if (ligne) {
    const dejaH = getTotalJour(ligne.ressource, date, ligneId); // exclut la ligne courante
    const totalAvec = dejaH + heures;
    if (totalAvec > 8) {
      pendingPPHData = { ligneId, date, heures };
      renderPP(); // sortir du mode edit avant d'ouvrir la modale
      showSurchargeAlert(ligne.ressource, date, heures, totalAvec, null);
      return;
    }
  }
  // Pas de surcharge — enregistrer
  const idx = heuresProjets.findIndex(x => x.ligneId === ligneId && x.date === date);
  if (idx >= 0) heuresProjets[idx].heures = heures;
  else heuresProjets.push({id: nextId++, ligneId, projetId: currentProjId, date, heures});
  saveAllData();
  renderPP();
}

function forceSavePPH() {
  // Callback générique (absences, HP)
  if (window._surchargeForceCallback) {
    window._surchargeForceCallback();
    window._surchargeForceCallback = null;
  }
  // Heures projet (pendingPPHData)
  if (pendingPPHData) {
    const { ligneId, date, heures } = pendingPPHData;
    const idx = heuresProjets.findIndex(x => x.ligneId === ligneId && x.date === date);
    if (idx >= 0) {
      heuresProjets[idx].heures = heures;
      saveAllData();
    } else {
      const fh={id:nextId++, ligneId, projetId:currentProjId, date, heures};
      heuresProjets.push(fh);
      saveAllData();
    }
    pendingPPHData = null;
    renderPP();
  }
  closeOverlay('surchargeOverlay');
  showToast('Enregistré malgré la surcharge', 'ok');
}

function cancelPPH(inp, oldVal) {
  renderPP();
}

function closePPHInput() {
  const inp = document.getElementById('ppInlineInput');
  if (inp) inp.blur();
}
