// ═══════════════════════════════════════════════════════════════
// ACCUEIL PROJET
// ═══════════════════════════════════════════════════════════════
let currentProjetAccueilId = null;

function openProjetAccueil(projId) {
  currentProjetAccueilId = projId;

  showPage('projetaccueil');
}

function renderProjetAccueil() {
  const p = projets.find(x => x.id === currentProjetAccueilId);
  if (!p) return;

  // ── Titre ──
  document.getElementById('paTitle').textContent = '🏠 ' + p.Nom;
  document.getElementById('paSub').textContent = (p.Commande || '') + (p.Client ? ' · ' + p.Client : '') + (p.Entite ? ' · ' + p.Entite : '');

  // ── Fiche projet ──
  const posteColors = { LA:'#1a3a5c', LS:'#1a7a4a', CONV:'#f07800', Mixte:'#7c3aed', Autre:'#64748b' };
  const statColor = {'En cours':'var(--green-l)','Offre':'var(--orange-l)','Non démarré':'var(--grey-200)','Stand-by':'var(--purple-l)','Terminé':'var(--grey-200)'};
  const statTxt   = {'En cours':'var(--green)','Offre':'var(--orange)','Non démarré':'var(--grey-600)','Stand-by':'var(--purple)','Terminé':'var(--grey-600)'};

  const fields = [
    { label: 'N° Commande',    value: p.Commande || '—' },
    { label: 'EOTP',           value: p.EOTP || '—', mono: true },
    { label: 'Nom du projet',  value: p.Nom || '—', bold: true },
    { label: 'Type / Domaine', value: p.Type || '—', color: posteColors[p.Type] },
    { label: 'Entité',         value: p.Entite || '—' },
    { label: 'Responsable',    value: p.Responsable || '—' },
    { label: 'Client',         value: p.Client || '—' },
    { label: 'Statut',         value: p.Statut || '—', badge: true },
    { label: 'Lot',            value: p.Lot || '—' },
    { label: 'Fiabilité',      value: p.Fiabilite || '—' },
    { label: 'Date début',     value: p.DateDebut ? new Date(p.DateDebut+'T00:00:00').toLocaleDateString('fr-FR') : '—' },
    { label: 'Déb. travaux',   value: p.DateTravaux ? new Date(p.DateTravaux+'T00:00:00').toLocaleDateString('fr-FR') : '—' },
    { label: 'Descriptif',     value: p.Descriptif || '—', full: true },
  ];

  document.getElementById('paFiche').innerHTML = fields.map(f => {
    let valHtml = f.bold
      ? `<span style="font-weight:700;color:var(--navy)">${f.value}</span>`
      : f.color
        ? `<span style="font-weight:700;color:${f.color}">${f.value}</span>`
        : f.mono
          ? `<span style="font-family:'DM Mono',monospace;font-size:11px">${f.value}</span>`
          : f.badge
            ? `<span style="background:${statColor[p.Statut]};color:${statTxt[p.Statut]};padding:2px 8px;border-radius:4px;font-size:11px;font-weight:600">${f.value}</span>`
            : `<span style="font-size:13px;color:var(--grey-700)">${f.value}</span>`;
    return `<div style="${f.full ? 'grid-column:1/-1;' : ''}">
      <div style="font-size:11px;font-weight:600;color:var(--grey-500);margin-bottom:3px;text-transform:uppercase;letter-spacing:.4px">${f.label}</div>
      ${valHtml}
    </div>`;
  }).join('');

  // ── Heures planifiées ──
  const todayISO = fmtISO(new Date());
  const lignesPj = lignesProjets.filter(l => l.projetId === p.id);

  // Total à venir + par ressource à venir
  let hFutur = 0;
  const hParRsc = {}; // ressource → heures à venir
  heuresProjets.forEach(h => {
    const l = lignesProjets.find(l => l.id === h.ligneId);
    if (!l || l.projetId !== p.id) return;
    if (h.date < todayISO) return; // seulement le futur
    const hrs = parseFloat(h.heures) || 0;
    hFutur += hrs;
    const rsc = l.ressource || '—';
    hParRsc[rsc] = (hParRsc[rsc] || 0) + hrs;
  });

  // Tri par heures décroissantes
  const rscSorted = Object.entries(hParRsc).sort((a, b) => b[1] - a[1]);

  document.getElementById('paHeures').innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px">
      <span style="font-size:11px;color:var(--grey-500)">Total à venir</span>
      <span style="font-size:28px;font-weight:800;color:var(--orange);font-family:'DM Mono',monospace;line-height:1">${hFutur}h</span>
    </div>`;

  document.getElementById('paHeuresRsc').innerHTML = rscSorted.length === 0
    ? '<div style="font-size:11px;color:var(--grey-400)">Aucune heure planifiée</div>'
    : rscSorted.map(([rsc, h]) => `
        <div style="display:flex;justify-content:space-between;align-items:baseline;padding:3px 0;border-bottom:1px solid var(--grey-100)">
          <span style="font-size:11px;color:var(--grey-700);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:150px" title="${rsc}">${rsc}</span>
          <span style="font-size:11px;font-weight:700;color:var(--navy);font-family:'DM Mono',monospace;flex-shrink:0;margin-left:8px">${h % 1 === 0 ? h : h.toFixed(1)}h</span>
        </div>`).join('');

  // ── Prochains jalons ──
  const taches = ganttTaches.filter(t => t.projetId === p.id);
  const jalons = taches.filter(t => t.jalon && t.jalon >= todayISO).sort((a,b) => a.jalon.localeCompare(b.jalon));
  const fmtD = s => new Date(s+'T00:00:00').toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit', year:'2-digit'});

  document.getElementById('paJalons').innerHTML = jalons.length === 0
    ? '<div style="font-size:12px;color:var(--grey-500);padding:8px 0">Aucun jalon à venir</div>'
    : jalons.map(t => `
      <div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0;border-bottom:1px solid var(--grey-100)">
        <span style="font-size:10px;font-weight:700;color:var(--orange);font-family:'DM Mono',monospace;flex-shrink:0;padding-top:1px">${fmtD(t.jalon)}</span>
        <span style="font-size:11px;color:var(--grey-700);line-height:1.4">${t.nom}</span>
      </div>`).join('');

  // ── Avancement (tâches) ──
  const tachesAvecDates = taches.filter(t => t.dateDebut && t.dateFin);
  const tachesTerminees = tachesAvecDates.filter(t => t.dateFin < todayISO).length;
  const tachesEnCours   = tachesAvecDates.filter(t => t.dateDebut <= todayISO && t.dateFin >= todayISO).length;
  const tachesTotal     = tachesAvecDates.length;
  const pctTaches       = tachesTotal > 0 ? Math.round(tachesTerminees / tachesTotal * 100) : 0;

  document.getElementById('paAvancement').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:10px">
      <div>
        <div style="display:flex;justify-content:space-between;margin-bottom:5px">
          <span style="font-size:11px;color:var(--grey-500)">Tâches terminées</span>
          <span style="font-size:12px;font-weight:700;color:var(--green)">${tachesTerminees} / ${tachesTotal}</span>
        </div>
        <div style="height:6px;background:var(--grey-200);border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${pctTaches}%;background:var(--green);border-radius:3px;transition:width .4s"></div>
        </div>
        <div style="font-size:10px;color:var(--grey-400);margin-top:3px">${pctTaches}% terminé</div>
      </div>
      ${tachesEnCours > 0 ? `<div style="font-size:11px;color:var(--navy)"><b>${tachesEnCours}</b> tâche${tachesEnCours>1?'s':''} en cours</div>` : ''}
      <div style="font-size:11px;color:var(--grey-500)">${jalons.length} jalon${jalons.length>1?'s':''} à venir</div>
    </div>`;

  // ── Graphique heures planifiées 6 prochains mois ──
  // Calculer les 6 prochains mois
  const now = new Date();
  const months6 = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const fin = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    months6.push({
      label: MONTHS_FR[d.getMonth()] + ' ' + d.getFullYear(),
      dateDebut: fmtISO(d),
      dateFin: fmtISO(fin)
    });
  }

  // Récupérer toutes les ressources du projet
  const rscsDuProjet = [...new Set(
    lignesProjets.filter(l => l.projetId === p.id).map(l => l.ressource).filter(Boolean)
  )].sort();

  // Heures par ressource par mois
  const chartData = {};
  rscsDuProjet.forEach(rsc => { chartData[rsc] = new Array(6).fill(0); });

  heuresProjets.forEach(h => {
    if (!h.date || h.date < months6[0].dateDebut || h.date > months6[5].dateFin) return;
    const l = lignesProjets.find(l => l.id === h.ligneId);
    if (!l || l.projetId !== p.id || !l.ressource) return;
    const mi = months6.findIndex(m => h.date >= m.dateDebut && h.date <= m.dateFin);
    if (mi >= 0) chartData[l.ressource][mi] += parseFloat(h.heures) || 0;
  });

  // Couleurs pour les ressources
  const chartColors = ['#1a3a5c','#f07800','#1a7a4a','#7c3aed','#e11d48','#0891b2','#d97706','#059669'];

  document.getElementById('paChartLabel').textContent =
    rscsDuProjet.length === 0 ? 'Aucune heure planifiée sur cette période'
    : rscsDuProjet.length + ' ressource' + (rscsDuProjet.length > 1 ? 's' : '');

  // Détruire ancien chart si existant
  if (window._paChartInst) { window._paChartInst.destroy(); window._paChartInst = null; }

  const ctx = document.getElementById('paChart');
  if (!ctx) return;

  if (rscsDuProjet.length === 0) {
    ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
    return;
  }

  window._paChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months6.map(m => m.label),
      datasets: rscsDuProjet.map((rsc, i) => ({
        label: rsc,
        data: chartData[rsc],
        backgroundColor: chartColors[i % chartColors.length] + 'cc',
        borderColor:     chartColors[i % chartColors.length],
        borderWidth: 1,
        borderRadius: 3,
        borderSkipped: false
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12, padding: 12 } },
        tooltip: {
          callbacks: { label: ctx => ctx.dataset.label + ' : ' + ctx.parsed.y + 'h' }
        }
      },
      scales: {
        x: { stacked: false, grid: { display: false }, ticks: { font: { size: 10 } } },
        y: {
          stacked: false,
          beginAtZero: true,
          ticks: { font: { size: 10 }, callback: v => v + 'h' },
          grid: { color: '#e2e8f0' }
        }
      }
    }
  });
}
