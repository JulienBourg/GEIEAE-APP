// ═══════════════════════════════════════════════════════════════
// PARAMS — RESSOURCES
// ═══════════════════════════════════════════════════════════════
let selRscId=null;

function renderRsc(){
  selRscId=null;
  document.getElementById('btnEditRsc').disabled=true;
  document.getElementById('btnDelRsc').disabled=true;
  document.getElementById('rscBody').innerHTML=ressources.map(r=>`
    <tr onclick="selectRsc(${r.id},this)" style="cursor:pointer" id="rsc-row-${r.id}">
      <td><input type="radio" name="rscSel" onclick="selectRsc(${r.id},document.getElementById('rsc-row-${r.id}'))"></td>
      <td style="font-weight:500">${r.Nom}</td>
      <td>${r.Prenom}</td>
      <td><span class="badge ${r.Entreprise==='Atlantique Etudes'?'badge-ae':'badge-eqos'}" style="font-size:11px;padding:2px 8px">${r.Entreprise==='Atlantique Etudes'?'AE':'EQOS'}</span></td>
      <td><span style="background:var(--navy-xl);color:var(--navy);padding:2px 6px;border-radius:3px;font-size:11px;font-weight:600">${r.Poste}</span></td>
      <td><span style="background:${r.Pays==='Luxembourg'?'var(--purple-l)':'var(--navy-xl)'};color:${r.Pays==='Luxembourg'?'var(--purple)':'var(--navy)'};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${r.Pays||'France'}</span></td>
    </tr>`).join('');
}

function selectRsc(id,row){
  selRscId=id;
  document.querySelectorAll('#rscBody tr').forEach(r=>r.style.background='');
  if(row) row.style.background='var(--navy-xl)';
  document.getElementById('btnEditRsc').disabled=false;
  document.getElementById('btnDelRsc').disabled=false;
}

function editSelectedRsc(){if(selRscId) openRscModal(selRscId);}
function deleteSelectedRsc(){
  if(!selRscId)return;
  if(!confirm('Supprimer cette ressource ?'))return;
  ressources=ressources.filter(r=>r.id!==selRscId);
  saveAllData();
  renderRsc();showToast('Ressource supprimée','ok');
}

let curRscId=null;

function openRscModal(id){
  curRscId=id;
  if(id){
    const r=ressources.find(x=>x.id===id);
    document.getElementById('rscMTitle').textContent='Modifier la ressource';
    document.getElementById('rscNom').value=r.Nom;
    document.getElementById('rscPrenom').value=r.Prenom;
    document.getElementById('rscEnt').value=r.Entreprise;
    document.getElementById('rscPoste').value=r.Poste;
    document.getElementById('rscPays').value=r.Pays||'France';
  } else {
    document.getElementById('rscMTitle').textContent='Ajouter une ressource';
    ['rscNom','rscPrenom'].forEach(f=>document.getElementById(f).value='');
    document.getElementById('rscPays').value='France';
  }
  openOverlay('rscOverlay');
}

function saveRsc(){
  const obj={
    Nom:document.getElementById('rscNom').value.toUpperCase(),
    Prenom:document.getElementById('rscPrenom').value,
    Entreprise:document.getElementById('rscEnt').value,
    Poste:document.getElementById('rscPoste').value,
    HeuresHebdo:40,
    Pays:document.getElementById('rscPays').value,
  };
  if(!obj.Nom||!obj.Prenom){showToast('Nom et prénom requis','err');return;}
  if(curRscId){const i=ressources.findIndex(r=>r.id===curRscId);ressources[i]={...ressources[i],...obj};}
  else ressources.push({id:nextId++,...obj});
  saveAllData();
  showToast('Enregistré','ok');closeOverlay('rscOverlay');renderRsc();
}
