// ═══════════════════════════════════════════════════════════════
// PROJETS
// ═══════════════════════════════════════════════════════════════
function renderProj(){
  const q=(document.getElementById('projSearch')?.value||'').toLowerCase().trim();
  const filtered=projets.filter(p=>!q||
    p.Nom.toLowerCase().includes(q)||
    (p.Commande||'').toLowerCase().includes(q)||
    (p.Client||'').toLowerCase().includes(q)||
    (p.Responsable||'').toLowerCase().includes(q)||
    (p.Statut||'').toLowerCase().includes(q)
  );
  const cnt=document.getElementById('projCount');
  if(cnt) cnt.textContent=q?`${filtered.length} / ${projets.length} projet${projets.length>1?'s':''}`:
    `${projets.length} projet${projets.length>1?'s':''}`;
  const statCls={En_cours:'ok',Offre:'err'};
  const statColor={'En cours':'var(--green-l)','Offre':'var(--orange-l)','Non démarré':'var(--grey-200)','Stand-by':'var(--purple-l)','Terminé':'var(--grey-200)'};
  const statTxt={'En cours':'var(--green)','Offre':'var(--orange)','Non démarré':'var(--grey-600)','Stand-by':'var(--purple)','Terminé':'var(--grey-600)'};
  document.getElementById('projBody').innerHTML=filtered.length===0?
    `<tr><td colspan="8" style="text-align:center;padding:32px;color:var(--grey-500);font-size:13px">Aucun projet ne correspond à la recherche</td></tr>`:
    filtered.map(p=>`
    <tr>
      <td style="font-family:'DM Mono',monospace;font-size:12px">${p.Commande}</td>
      <td style="font-weight:500;color:var(--navy)">${p.Nom}</td>
      <td><span style="background:var(--navy-xl);color:var(--navy);padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${p.Type}</span></td>
      <td><span class="badge ${p.Entite==='Atlantique Etudes'?'badge-ae':'badge-eqos'}" style="font-size:11px;padding:2px 8px">${p.Entite==='Atlantique Etudes'?'AE':'EQOS'}</span></td>
      <td style="font-size:12px">${p.Responsable}</td>
      <td style="font-size:12px">${p.Client}</td>
      <td><span style="background:${statColor[p.Statut]};color:${statTxt[p.Statut]};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${p.Statut}</span></td>
      <td><div class="td-actions">
        <button class="btn btn-primary btn-sm" onclick="openProjetAccueil(${p.id})" title="Accueil du projet">🏠 Accueil projet</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProjDirect(${p.id})" title="Supprimer le projet">🗑️</button>
      </div></td>
    </tr>`).join('');
}

let curProjId=null;

function openProjModal(id){
  curProjId=id;
  if(id){
    const p=projets.find(x=>x.id===id);
    document.getElementById('projMTitle').textContent='Modifier le projet';
    document.getElementById('projCmd').value=p.Commande||'';
    document.getElementById('projEOTP').value=p.EOTP||'';
    document.getElementById('projNom').value=p.Nom||'';
    document.getElementById('projType').value=p.Type||'LA';
    document.getElementById('projEnt').value=p.Entite||'Atlantique Etudes';
    document.getElementById('projStatut').value=p.Statut||'En cours';
    document.getElementById('projResp').value=p.Responsable||'';
    document.getElementById('projClient').value=p.Client||'';
    document.getElementById('projDate').value=p.DateDebut||'';
    document.getElementById('projDateTravaux').value=p.DateTravaux||'';
    document.getElementById('projLot').value=p.Lot||'';
    document.getElementById('projFiabilite').value=p.Fiabilite||'';
    document.getElementById('projDescriptif').value=p.Descriptif||'';
    document.getElementById('projDelBtn').style.display='inline-flex';
  } else {
    document.getElementById('projMTitle').textContent='Nouveau projet';
    ['projCmd','projEOTP','projNom','projResp','projClient','projDate','projDateTravaux','projDescriptif'].forEach(f=>document.getElementById(f).value='');
    document.getElementById('projLot').value='';
    document.getElementById('projFiabilite').value='';
    document.getElementById('projDelBtn').style.display='none';
  }
  openOverlay('projOverlay');
}

function saveProj(){
  const obj={
    Commande:document.getElementById('projCmd').value,
    EOTP:document.getElementById('projEOTP').value,
    Nom:document.getElementById('projNom').value,
    Type:document.getElementById('projType').value,
    Entite:document.getElementById('projEnt').value,
    Statut:document.getElementById('projStatut').value,
    Responsable:document.getElementById('projResp').value,
    Client:document.getElementById('projClient').value,
    DateDebut:document.getElementById('projDate').value,
    DateTravaux:document.getElementById('projDateTravaux').value,
    Lot:document.getElementById('projLot').value,
    Fiabilite:document.getElementById('projFiabilite').value,
    Descriptif:document.getElementById('projDescriptif').value,
  };
  if(!obj.Nom){showToast('Nom requis','err');return;}
  if(curProjId){const i=projets.findIndex(p=>p.id===curProjId);projets[i]={...projets[i],...obj};}
  else projets.push({id:nextId++,...obj});
  saveAllData();
  showToast('Enregistré','ok');closeOverlay('projOverlay');renderProj();
  // Rafraîchir l'accueil projet si le projet modifié est celui affiché
  if(currentProjetAccueilId && currentProjetAccueilId === curProjId) renderProjetAccueil();
}

function deleteProj(){
  if(!curProjId)return;
  _cascadeDeleteProjet(curProjId);
  saveAllData();
  closeOverlay('projOverlay');renderProj();showToast('Supprimé','ok');
}

function deleteProjDirect(id){
  if(!confirm('Supprimer ce projet et toutes ses données (Gantt, planning, heures) ?'))return;
  _cascadeDeleteProjet(id);
  saveAllData();renderProj();showToast('Supprimé','ok');
}

function _cascadeDeleteProjet(id){
  // 1. Lignes et heures associées
  const lignesIds=lignesProjets.filter(l=>l.projetId===id).map(l=>l.id);
  heuresProjets=heuresProjets.filter(h=>!lignesIds.includes(h.ligneId));
  lignesProjets=lignesProjets.filter(l=>l.projetId!==id);
  // 2. Tâches Gantt
  ganttTaches=ganttTaches.filter(t=>t.projetId!==id);
  // 3. Projet lui-même
  projets=projets.filter(p=>p.id!==id);
}
