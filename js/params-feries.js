// ═══════════════════════════════════════════════════════════════
// PARAMS — JOURS FÉRIÉS
// ═══════════════════════════════════════════════════════════════
let selFerieId=null;

function renderFeries(){
  selFerieId=null;
  document.getElementById('btnDelFerie').disabled=true;
  const fYear=document.getElementById('ferieFilterYear').value;
  const list=joursFeries.filter(f=>!fYear||String(f.Annee)===fYear);
  const paysCls={'France':'badge-ae','Luxembourg':'badge-eqos','France+Luxembourg':'badge-ae'};
  document.getElementById('ferieBody').innerHTML=list.map(f=>`
    <tr onclick="selectFerie(${f.id},this)" style="cursor:pointer" id="ferie-row-${f.id}">
      <td><input type="radio" name="ferieSel" onclick="selectFerie(${f.id},document.getElementById('ferie-row-${f.id}'))"></td>
      <td style="font-weight:500">${f.Libelle}</td>
      <td style="font-family:'DM Mono',monospace;font-size:12px">${fmtDisp(f.Date)}</td>
      <td><span class="badge ${paysCls[f.Pays]||'badge-ae'}" style="font-size:11px;padding:2px 8px">${f.Pays}</span></td>
      <td style="font-family:'DM Mono',monospace;font-size:12px">${f.Annee}</td>
    </tr>`).join('');
}

function selectFerie(id,row){
  selFerieId=id;
  document.querySelectorAll('#ferieBody tr').forEach(r=>r.style.background='');
  if(row) row.style.background='var(--navy-xl)';
  document.getElementById('btnDelFerie').disabled=false;
}

function deleteSelectedFerie(){
  if(!selFerieId)return;
  if(!confirm('Supprimer ce jour férié ?'))return;
  joursFeries=joursFeries.filter(f=>f.id!==selFerieId);
  saveAllData();
  renderFeries();showToast('Supprimé','ok');
}

let curFerieId=null;

function openFerieModal(id){
  curFerieId=id;
  document.getElementById('ferieLib').value='';
  document.getElementById('ferieDate').value='';
  openOverlay('ferieOverlay');
}

function saveFerie(){
  const lib=document.getElementById('ferieLib').value;
  const date=document.getElementById('ferieDate').value;
  const pays=document.getElementById('feriePays').value;
  if(!lib||!date){showToast('Champs manquants','err');return;}
  const annee=new Date(date+'T00:00:00').getFullYear();
  joursFeries.push({id:nextId++,Libelle:lib,Date:date,Pays:pays,Annee:annee});
  saveAllData();
  showToast('Enregistré','ok');closeOverlay('ferieOverlay');renderFeries();
}
