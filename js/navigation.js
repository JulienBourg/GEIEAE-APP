// ═══════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════
function renderHomeKpi() {
  // Projets dont le statut est "En cours"
  const nbProjets = projets.filter(p => p.Statut === 'En cours').length;
  const badgeProjets = document.getElementById('homeBadgeProjets');
  if (badgeProjets) badgeProjets.textContent = nbProjets + ' projet' + (nbProjets > 1 ? 's' : '') + ' en cours';



  // Prochains jalons (30 jours)
  const todayISO = fmtISO(new Date());
  // Jalons du mois en cours + mois suivant
  const now = new Date();
  const endOfNextMonth = fmtISO(new Date(now.getFullYear(), now.getMonth() + 2, 0));
  const jalons   = ganttTaches
    .filter(t => t.jalon && t.jalon >= todayISO && t.jalon <= endOfNextMonth)
    .sort((a,b) => a.jalon.localeCompare(b.jalon));

  const countEl = document.getElementById('homeJalonsCount');
  const listEl  = document.getElementById('homeJalonsList');
  if (countEl) countEl.textContent = jalons.length || '—';

  const fmtD = s => new Date(s+'T00:00:00').toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});

  if (listEl) {
    listEl.innerHTML = jalons.length
      ? jalons.map(t => {
          const proj    = projets.find(p => p.id === t.projetId);
          const projNom = proj ? (proj.Nom || proj.Commande || '—') : '—';
          return `<div style="display:flex;align-items:flex-start;gap:8px;padding:7px 0;border-bottom:1px solid var(--grey-100)">
            <span style="font-size:10px;font-weight:700;color:var(--orange);font-family:'DM Mono',monospace;flex-shrink:0;padding-top:1px">${fmtD(t.jalon)}</span>
            <span style="font-size:11px;color:var(--grey-600);line-height:1.4"><span style="font-weight:600;color:var(--navy)">${projNom}</span><br>${t.nom}</span>
          </div>`;
        }).join('')
      : '<div style="font-size:11px;color:var(--grey-500);padding:8px 0">Aucun jalon dans les 30 prochains jours</div>';
  }
}

function showPage(id) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n=>{
    if(n.getAttribute('onclick')===`showPage('${id}')`) n.classList.add('active');
  });
  if(id==='home') renderHomeKpi();
  if(id==='absences') renderAbs();
  if(id==='horsprojets') renderHP();
  if(id==='projets') renderProj();
  if(id==='plancharge') renderPC();
  if(id==='planninghebdo') renderPH();
  if(id==='dashboard') { dbInit(); renderDashboard(); }
  if(id==='rte') { rteInit(); rteRefresh(); }
  if(id==='timeline') { tlInit(); renderTimeline(); }
  if(id==='projetaccueil') renderProjetAccueil();
  if(id==='ganttprojet') renderGantt();
  if(id==='params') {renderRsc();renderFeries();}
}
