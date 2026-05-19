// ═══════════════════════════════════════════════════════════════
// ABSENCES
// ═══════════════════════════════════════════════════════════════
let absStart=getMonday(new Date());
const ABS_DAYS=28;

function absNav(w){absStart=addDays(absStart,w*7);renderAbs();}
function absToday(){absStart=getMonday(new Date());renderAbs();}

function renderAbs(){
  const fEnt=document.getElementById('absFilterEnt').value;
  const rsc=ressources.filter(r=>!fEnt||r.Entreprise===fEnt);
  const dates=buildGanttHead(absStart,ABS_DAYS,'absHead');
  const end=addDays(absStart,ABS_DAYS-1);
  document.getElementById('absWeekLabel').textContent=
    `${absStart.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})} — ${end.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}`;
  const chipMap={Congés:'chip-conges',Maladie:'chip-maladie',RTT:'chip-rtt',Formation:'chip-formation',Autre:'chip-autre'};
  let html=rsc.map(r=>buildGanttRow(r,dates,(full,ds,tdCls)=>{
    const abs=absences.find(a=>a.Ressource===full&&a.Date===ds);
    if(abs){
      const cc=chipMap[abs.Type]||'chip-autre';
      return `<td class="td-cell${tdCls} white-bg" data-rsc="${full}" data-date="${ds}" onclick="openAbsModal('${full}','${ds}',${abs.id})" title="${abs.Type} — ${abs.Heures}h"><span class="chip ${cc}" style="pointer-events:none">${abs.Heures}</span></td>`;
    }
    return `<td class="td-cell${tdCls} white-bg" data-rsc="${full}" data-date="${ds}" onclick="openAbsModal('${full}','${ds}',null)"></td>`;
  })).join('');
  document.getElementById('absBody').innerHTML=html;
  setTimeout(()=>syncHeadWidth('abs'),0);
}

let curAbsId=null,curAbsType='Congés';

function openAbsModal(rsc,date,absId){
  curAbsId=absId;
  const sel=document.getElementById('absRsc');
  sel.innerHTML=ressources.map(r=>`<option value="${rscName(r)}" ${rsc===rscName(r)?'selected':''}>${rscName(r)}</option>`).join('');
  document.getElementById('absDate').value=date||fmtISO(new Date());
  if(absId){
    const a=absences.find(x=>x.id===absId);
    document.getElementById('absMTitle').textContent='Modifier une absence';
    document.getElementById('absMSub').textContent=`${a.Ressource} — ${fmtDisp(a.Date)}`;
    document.getElementById('absH').value=a.Heures;
    selAbsType(a.Type,null);
    document.getElementById('absDelBtn').style.display='inline-flex';
  } else {
    document.getElementById('absMTitle').textContent='Saisir une absence';
    document.getElementById('absMSub').textContent=rsc?`${rsc} — ${fmtDisp(date)}`:'Nouvelle absence';
    document.getElementById('absH').value=8;
    selAbsType('Congés',null);
    document.getElementById('absDelBtn').style.display='none';
  }
  openOverlay('absOverlay');
  setTimeout(()=>document.getElementById('absH').select(),120);
}

function selAbsType(type,btn){
  curAbsType=type;
  document.querySelectorAll('#absOverlay .type-btn').forEach(b=>b.className='type-btn');
  const map={Congés:'sel-conges',Maladie:'sel-maladie',RTT:'sel-rtt',Formation:'sel-formation'};
  if(btn){btn.classList.add(map[type]||'sel-conges');}
  else document.querySelectorAll('#absOverlay .type-btn').forEach(b=>{
    if(b.textContent.trim().includes(type))b.classList.add(map[type]||'sel-conges');
  });
}

function getTotalJour(ressourceName, date, excludeLigneId) {
  // Calcule le total des heures planifiées pour une ressource un jour donné
  // excludeLigneId : ligne projet en cours de saisie (exclure pour ne pas compter 2x)
  let total = 0;

  // Heures projets (toutes les lignes sauf celle en cours)
  lignesProjets
    .filter(l => l.ressource === ressourceName && l.id !== excludeLigneId)
    .forEach(l => {
      const h = heuresProjets.find(x => x.ligneId === l.id && x.date === date);
      if (h) total += h.heures;
    });

  // Absences
  const abs = absences.find(a => a.Ressource === ressourceName && a.Date === date);
  if (abs) total += abs.Heures;

  // Hors projets
  const hp = horsProjets.find(a => a.Ressource === ressourceName && a.Date === date);
  if (hp) total += hp.Heures;

  return total;
}

// Conserver getChargeJour pour compatibilité (utilisé dans le dashboard)
function getChargeJour(ressourceName, date, excludeType) {
  const capJour = 8;
  let total = 0;
  const details = [];
  const lignesRsc = lignesProjets.filter(l => l.ressource === ressourceName);
  let hProj = 0;
  lignesRsc.forEach(l => {
    const h = heuresProjets.find(x => x.ligneId === l.id && x.date === date);
    if (h) hProj += h.heures;
  });
  if (hProj > 0) { total += hProj; }
  if (excludeType !== 'absence') {
    const abs = absences.find(a => a.Ressource === ressourceName && a.Date === date);
    if (abs) { total += abs.Heures; details.push(`🏖️ ${abs.Type} — ${abs.Heures}h`); }
  }
  if (excludeType !== 'hp') {
    const hp = horsProjets.find(a => a.Ressource === ressourceName && a.Date === date);
    if (hp) { total += hp.Heures; details.push(`🔧 ${hp.Nature} — ${hp.Heures}h`); }
  }
  return { total, capJour, details };
}


function showSurchargeAlert(ressourceName, date, nouvellesH, totalFinal, onForce) {
  const capJour = 8;
  const dejaH   = totalFinal - nouvellesH;
  const dateDisp = new Date(date+'T00:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long'});
  document.getElementById('surchargeSub').textContent = ressourceName + ' — ' + dateDisp;

  // Construire le détail de la journée
  let detail = `<div style="background:var(--red-l);border-radius:var(--r);padding:12px;margin-bottom:12px">
    <div style="font-weight:700;color:var(--red);margin-bottom:8px">⚠️ Surcharge détectée : ${dejaH}h déjà planifiées + ${nouvellesH}h = <b>${totalFinal}h</b> (capacité : ${capJour}h)</div>`;
  // Détail existant
  lignesProjets.filter(l=>l.ressource===ressourceName).forEach(l=>{
    const h=heuresProjets.find(x=>x.ligneId===l.id&&x.date===date);
    if(h){const p=projets.find(x=>x.id===l.projetId);const t=ganttTaches.find(x=>x.id===l.tacheGanttId);
    detail+=`<div style="font-size:12px;padding:3px 0;border-top:1px solid #fca5a5">📋 <b>${p?p.Nom:'?'}</b> / ${t?t.nom:'?'} — ${h.heures}h</div>`;}
  });
  const abs=absences.find(a=>a.Ressource===ressourceName&&a.Date===date);
  if(abs)detail+=`<div style="font-size:12px;padding:3px 0;border-top:1px solid #fca5a5">🏖️ Absence (${abs.Type}) — ${abs.Heures}h</div>`;
  const hp=horsProjets.find(a=>a.Ressource===ressourceName&&a.Date===date);
  if(hp)detail+=`<div style="font-size:12px;padding:3px 0;border-top:1px solid #fca5a5">🔧 ${hp.Nature} — ${hp.Heures}h</div>`;
  detail += '</div>';
  document.getElementById('surchargeDetail').innerHTML = detail;
  window._surchargeForceCallback = onForce;
  openOverlay('surchargeOverlay');
}

// ── Navigation clavier dans les modales Absences / Hors Projets ──
// ← → : jour précédent/suivant (même ressource)
// ↑ ↓ : ressource précédente/suivante (même date)
// Enter : valider + ↓ ressource suivante
// Escape : fermer sans sauvegarder
function handleModalKey(e, mode) {
  const isAbs       = mode === 'abs';
  const overlayId   = isAbs ? 'absOverlay' : 'hpOverlay';
  const rscField    = isAbs ? 'absRsc'     : 'hpRsc';
  const dateField   = isAbs ? 'absDate'    : 'hpDate';
  const hField      = isAbs ? 'absH'       : 'hpH';
  const bodyId      = isAbs ? 'absBody'    : 'hpBody';
  const renderFn    = isAbs ? renderAbs    : renderHP;

  if (e.key === 'Escape') { closeOverlay(overlayId); return; }

  const isLeft  = e.key === 'ArrowLeft';
  const isRight = e.key === 'ArrowRight';
  const isUp    = e.key === 'ArrowUp';
  const isDown  = e.key === 'ArrowDown';
  const isEnter = e.key === 'Enter';

  if (!isLeft && !isRight && !isUp && !isDown && !isEnter) return;
  e.preventDefault();

  const curRsc  = document.getElementById(rscField).value;
  const curDate = document.getElementById(dateField).value;
  const curH    = parseFloat(document.getElementById(hField).value) || 0;

  // Toutes les cellules navigables
  const allCells = Array.from(
    document.querySelectorAll('#' + bodyId + ' td[data-rsc][data-date]')
  ).filter(td => !td.classList.contains('we') && !td.classList.contains('ferie'));

  const curIdx = allCells.findIndex(td => td.dataset.rsc === curRsc && td.dataset.date === curDate);

  // Calculer destination
  let nextRsc = curRsc, nextDate = curDate;

  if (isLeft || isRight) {
    // Naviguer horizontalement : même ressource, date suivante/précédente
    const sameRscCells = allCells.filter(td => td.dataset.rsc === curRsc);
    const pos = sameRscCells.findIndex(td => td.dataset.date === curDate);
    const next = sameRscCells[pos + (isRight ? 1 : -1)];
    if (next) nextDate = next.dataset.date;
    else { closeOverlay(overlayId); return; }
  } else if (isDown || isEnter) {
    // Naviguer verticalement vers le bas : même date, ressource suivante
    const sameDateCells = allCells.filter(td => td.dataset.date === curDate);
    const pos = sameDateCells.findIndex(td => td.dataset.rsc === curRsc);
    const next = sameDateCells[pos + 1];
    if (next) nextRsc = next.dataset.rsc;
    else { closeOverlay(overlayId); return; }
  } else if (isUp) {
    const sameDateCells = allCells.filter(td => td.dataset.date === curDate);
    const pos = sameDateCells.findIndex(td => td.dataset.rsc === curRsc);
    const prev = sameDateCells[pos - 1];
    if (prev) nextRsc = prev.dataset.rsc;
    else { closeOverlay(overlayId); return; }
  }

  // Valider saisie courante si > 0
  if (curH > 0) {
    if (isAbs) {
      const type  = curAbsType || 'Congés';
      const absEx = absences.find(a => a.Ressource === curRsc && a.Date === curDate);
      const total = getTotalJour(curRsc, curDate, null) - (absEx ? absEx.Heures : 0) + curH;
      if (total > 8) {
        closeOverlay(overlayId);
        showSurchargeAlert(curRsc, curDate, curH, total, () => {
          const ex = absences.findIndex(a => a.Ressource === curRsc && a.Date === curDate);
          if (ex >= 0) absences[ex] = {...absences[ex], Heures:curH};
          else absences.push({id:nextId++, Ressource:curRsc, Date:curDate, Type:type, Heures:curH});
          saveAllData(); renderAbs();
        });
        return;
      }
      const ex = absences.findIndex(a => a.Ressource === curRsc && a.Date === curDate);
      if (ex >= 0) absences[ex] = {...absences[ex], Heures:curH};
      else absences.push({id:nextId++, Ressource:curRsc, Date:curDate, Type:type, Heures:curH});
    } else {
      const nat     = document.getElementById('hpNature').value;
      const comment = document.getElementById('hpComment').value.trim();
      const hpEx    = horsProjets.find(a => a.Ressource === curRsc && a.Date === curDate);
      const total   = getTotalJour(curRsc, curDate, null) - (hpEx ? hpEx.Heures : 0) + curH;
      if (total > 8) {
        closeOverlay(overlayId);
        showSurchargeAlert(curRsc, curDate, curH, total, () => {
          const ex = horsProjets.findIndex(a => a.Ressource === curRsc && a.Date === curDate);
          if (ex >= 0) horsProjets[ex] = {...horsProjets[ex], Heures:curH};
          else horsProjets.push({id:nextId++, Ressource:curRsc, Date:curDate, Nature:nat, Heures:curH, Commentaire:comment});
          saveAllData(); renderHP();
        });
        return;
      }
      const ex = horsProjets.findIndex(a => a.Ressource === curRsc && a.Date === curDate);
      if (ex >= 0) horsProjets[ex] = {...horsProjets[ex], Heures:curH};
      else horsProjets.push({id:nextId++, Ressource:curRsc, Date:curDate, Nature:nat, Heures:curH, Commentaire:comment});
    }
    saveAllData();
    renderFn();
  }

  // Ouvrir la cellule cible
  if (isAbs) openAbsModal(nextRsc, nextDate, null);
  else       openHPModal(nextRsc, nextDate, null);
  setTimeout(() => { const inp = document.getElementById(hField); if(inp) inp.select(); }, 80);
}


function saveAbsence(){
  const rsc=document.getElementById('absRsc').value;
  const date=document.getElementById('absDate').value;
  const h=parseFloat(document.getElementById('absH').value);
  if(!rsc||!date||!h){showToast('Champs manquants','err');return;}

  // Vérifier surcharge — total journée hors absence existante
  if(!curAbsId) {
    const dejaH = getTotalJour(rsc, date, null); // absences existantes incluses = 0 car pas encore ajoutée
    // Retirer une absence existante si on la remplace
    const absEx = absences.find(a=>a.Ressource===rsc&&a.Date===date);
    const totalAvecNouvelle = dejaH - (absEx ? absEx.Heures : 0) + h;
    if(totalAvecNouvelle > 8) {
      closeOverlay('absOverlay');
      showSurchargeAlert(rsc, date, h, totalAvecNouvelle, () => {
        const ex=absences.findIndex(a=>a.Ressource===rsc&&a.Date===date);
        if(ex>=0){absences[ex]={...absences[ex],Type:curAbsType,Heures:h};saveAllData();}
        else{const a={id:nextId++,Ressource:rsc,Date:date,Type:curAbsType,Heures:h};absences.push(a);saveAllData();}
        renderAbs();
      });
      return;
    }
  }

  if(curAbsId){
    const i=absences.findIndex(a=>a.id===curAbsId);
    absences[i]={...absences[i],Ressource:rsc,Date:date,Type:curAbsType,Heures:h};
    showToast('Absence modifiée','ok');
  } else {
    const ex=absences.findIndex(a=>a.Ressource===rsc&&a.Date===date);
    if(ex>=0){absences[ex]={...absences[ex],Type:curAbsType,Heures:h};showToast('Mise à jour','ok');}
    else{absences.push({id:nextId++,Ressource:rsc,Date:date,Type:curAbsType,Heures:h});showToast('Enregistré','ok');}
  }
  saveAllData();
  closeOverlay('absOverlay');renderAbs();
}

function deleteAbsence(){
  if(!curAbsId)return;
  absences=absences.filter(a=>a.id!==curAbsId);
  saveAllData();
  closeOverlay('absOverlay');renderAbs();showToast('Supprimé','ok');
}
