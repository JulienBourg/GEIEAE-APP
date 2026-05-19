// ═══════════════════════════════════════════════════════════════
// HORS PROJETS
// ═══════════════════════════════════════════════════════════════
let hpStart=getMonday(new Date());
const HP_DAYS=28;

function hpNav(w){hpStart=addDays(hpStart,w*7);renderHP();}
function hpToday(){hpStart=getMonday(new Date());renderHP();}

function renderHP(){
  const fEnt=document.getElementById('hpFilterEnt').value;
  const rsc=ressources.filter(r=>!fEnt||r.Entreprise===fEnt);
  const dates=buildGanttHead(hpStart,HP_DAYS,'hpHead');
  const end=addDays(hpStart,HP_DAYS-1);
  document.getElementById('hpWeekLabel').textContent=
    `${hpStart.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})} — ${end.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}`;
  let html=rsc.map(r=>buildGanttRow(r,dates,(full,ds,tdCls)=>{
    const hp=horsProjets.find(a=>a.Ressource===full&&a.Date===ds);
    if(hp)return `<td class="td-cell${tdCls} white-bg" data-rsc="${full}" data-date="${ds}" onclick="openHPModal('${full}','${ds}',${hp.id})" title="${hp.Nature}${hp.Commentaire?' — '+hp.Commentaire:''} — ${hp.Heures}h"><span class="chip chip-heures" style="pointer-events:none">${hp.Heures}</span></td>`;
    return `<td class="td-cell${tdCls} white-bg" data-rsc="${full}" data-date="${ds}" onclick="openHPModal('${full}','${ds}',null)"></td>`;
  })).join('');
  document.getElementById('hpBody').innerHTML=html;
  setTimeout(()=>syncHeadWidth('hp'),0);
}

let curHPId=null;

function openHPModal(rsc,date,hpId){
  curHPId=hpId;
  const sel=document.getElementById('hpRsc');
  sel.innerHTML=ressources.map(r=>`<option value="${rscName(r)}" ${rsc===rscName(r)?'selected':''}>${rscName(r)}</option>`).join('');
  document.getElementById('hpDate').value=date||fmtISO(new Date());
  if(hpId){
    const hp=horsProjets.find(x=>x.id===hpId);
    document.getElementById('hpMTitle').textContent='Modifier';
    document.getElementById('hpMSub').textContent=`${hp.Ressource} — ${fmtDisp(hp.Date)}`;
    document.getElementById('hpH').value=hp.Heures;
    document.getElementById('hpNature').value=hp.Nature;
    document.getElementById('hpComment').value=hp.Commentaire||'';
    document.getElementById('hpDelBtn').style.display='inline-flex';
  } else {
    document.getElementById('hpMTitle').textContent='Activité hors projet';
    document.getElementById('hpMSub').textContent=rsc?`${rsc} — ${fmtDisp(date)}`:'';
    document.getElementById('hpH').value=8;
    document.getElementById('hpComment').value='';
    document.getElementById('hpDelBtn').style.display='none';
  }
  openOverlay('hpOverlay');
  setTimeout(()=>document.getElementById('hpH').select(),120);
}

function saveHP(){
  const rsc=document.getElementById('hpRsc').value;
  const date=document.getElementById('hpDate').value;
  const h=parseFloat(document.getElementById('hpH').value);
  const nat=document.getElementById('hpNature').value;
  const comment=document.getElementById('hpComment').value.trim();
  if(!rsc||!date||!h){showToast('Champs manquants','err');return;}

  // Vérifier surcharge — total journée hors HP existant
  if(!curHPId) {
    const dejaH = getTotalJour(rsc, date, null);
    const hpEx = horsProjets.find(a=>a.Ressource===rsc&&a.Date===date);
    const totalAvecNouveau = dejaH - (hpEx ? hpEx.Heures : 0) + h;
    if(totalAvecNouveau > 8) {
      closeOverlay('hpOverlay');
      showSurchargeAlert(rsc, date, h, totalAvecNouveau, () => {
        horsProjets.push({id:nextId++,Ressource:rsc,Date:date,Nature:nat,Heures:h,Commentaire:comment});
        saveAllData(); renderHP();
      });
      return;
    }
  }

  if(curHPId){
    const i=horsProjets.findIndex(a=>a.id===curHPId);
    horsProjets[i]={...horsProjets[i],Ressource:rsc,Date:date,Nature:nat,Heures:h,Commentaire:comment};
  } else {
    horsProjets.push({id:nextId++,Ressource:rsc,Date:date,Nature:nat,Heures:h,Commentaire:comment});
  }
  saveAllData();
  showToast('Enregistré','ok');closeOverlay('hpOverlay');renderHP();
}

function deleteHP(){
  if(!curHPId)return;
  horsProjets=horsProjets.filter(a=>a.id!==curHPId);
  saveAllData();
  closeOverlay('hpOverlay');renderHP();showToast('Supprimé','ok');
}
