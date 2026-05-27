// ═══════════════════════════════════════════════════════════════
// PLANNING HEBDO
// ═══════════════════════════════════════════════════════════════
let phStart = getMonday(new Date());

function phNav(w) { phStart = addDays(phStart, w * 7); renderPH(); }
function phToday() { phStart = getMonday(new Date()); renderPH(); }

function renderPH() {
  const fEnt   = document.getElementById('phFilterEnt').value;
  const fPoste = document.getElementById('phFilterPoste')?.value || '';
  const rscList = ressources.filter(r =>
    (!fEnt   || r.Entreprise === fEnt) &&
    (!fPoste || r.Poste === fPoste)
  );

  // 5 jours ouvrés de la semaine
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(phStart, i);
    if (!isWE(d)) days.push(d);
  }

  const end = addDays(phStart, 6);
  document.getElementById('phWeekLabel').textContent =
    'Semaine ' + getWeekNum(phStart) + ' — ' +
    phStart.toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'});

  // ── HEAD ──
  let head = '<tr>';
  head += '<th class="col-ressource">Ressource</th>';
  days.forEach(d => {
    const ds = fmtISO(d);
    const ferie = isFerie(ds);
    const dayNames = ['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    const bg = ferie ? 'background:var(--navy-dark)' : '';
    head += `<th style="width:180px;min-width:180px;text-align:center;${bg}">
      <div style="font-size:11px;font-weight:600">${dayNames[d.getDay()]}</div>
      <div style="font-size:10px;opacity:.75;font-weight:400">${d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</div>
    </th>`;
  });
  head += '</tr>';
  document.getElementById('phHead').innerHTML = head;

  // ── BODY ──
  let body = '';
  rscList.forEach(r => {
    const full = rscName(r);
    const bCls = r.Entreprise === 'Atlantique Etudes' ? 'badge-ae' : 'badge-eqos';
    const bLbl = r.Entreprise === 'Atlantique Etudes' ? 'AE' : 'EQOS';

    let row = `<tr style="vertical-align:top">`;
    row += `<td class="td-ressource" style="vertical-align:middle">
      <span style="font-weight:500">${full}</span>
      <span class="badge ${bCls}">${bLbl}</span>
      <div style="font-size:10px;color:var(--grey-500);margin-top:1px">${r.Poste} · 40h</div>
    </td>`;

    days.forEach(d => {
      const ds = fmtISO(d);
      const ferie = isFerie(ds, r.Pays||'France');
      const today = isToday(ds);

      if (ferie) {
        row += `<td style="width:180px;min-width:180px;background:var(--yellow-l);text-align:center;vertical-align:middle;border-right:1px solid var(--grey-200);padding:6px;font-size:11px;color:var(--grey-600)">
          🎌 ${ferie.Libelle}
        </td>`;
        return;
      }

      const todayBg = 'background:#fff;';

      // Récupérer toutes les activités de cette ressource ce jour
      const items = [];

      // Projets
      const lignes = lignesProjets.filter(l => l.ressource === full);
      lignes.forEach(l => {
        const h = heuresProjets.find(x => x.ligneId === l.id && x.date === ds);
        if (h && h.heures > 0) {
          const proj = projets.find(p => p.id === l.projetId);
          const tacheG = ganttTaches.find(t => t.id === l.tacheGanttId);
          items.push({
            type: 'projet',
            label: proj ? proj.Nom : 'Projet',
            sub: l.tacheLibre || (tacheG ? tacheG.nom : ''),
            heures: h.heures,
            color: '#d1fae5',
            textColor: 'var(--green)',
            borderColor: '#6ee7b7'
          });
        }
      });

      // Absences
      const abs = absences.find(a => a.Ressource === full && a.Date === ds);
      if (abs) {
        const absColors = {
          Congés: {bg:'var(--navy-xl)', text:'var(--navy)', border:'var(--navy-light)'},
          Maladie: {bg:'var(--red-l)', text:'var(--red)', border:'#fca5a5'},
        };
        const c = absColors[abs.Type] || absColors.Congés;
        items.push({
          type: 'absence',
          label: abs.Type,
          sub: null,
          heures: abs.Heures,
          color: c.bg, textColor: c.text, borderColor: c.border
        });
      }

      // Hors projets
      const hp = horsProjets.find(a => a.Ressource === full && a.Date === ds);
      if (hp) {
        items.push({
          type: 'hp',
          label: hp.Nature,
          sub: hp.Commentaire || null,
          heures: hp.Heures,
          color: 'var(--orange-l)',
          textColor: 'var(--orange)',
          borderColor: '#fdba74'
        });
      }

      // Total heures du jour
      const totalH = items.reduce((s, x) => s + x.heures, 0);

      let cellContent = '';
      if (items.length === 0) {
        cellContent = '';
      } else {
        cellContent = items.map(it => `
          <div style="
            background:${it.color};
            border-left:3px solid ${it.borderColor};
            border-radius:4px;
            padding:4px 7px;
            margin-bottom:4px;
            min-height:36px;
          ">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:4px">
              <span style="font-size:11px;font-weight:600;color:${it.textColor};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px">${it.label}</span>
              <span style="font-size:11px;font-weight:700;color:${it.textColor};font-family:'DM Mono',monospace;flex-shrink:0">${it.heures}h</span>
            </div>
            ${it.sub ? `<div style="font-size:10px;color:${it.textColor};opacity:.75;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${it.sub}</div>` : ''}
          </div>`).join('');

        if (totalH > 0) {
          const cap = 8; // 8h/jour fixe
          const pct = Math.round((totalH / cap) * 100);
          const pctColor = pct >= 100 ? 'var(--red)' : pct >= 80 ? 'var(--orange)' : 'var(--grey-500)';
          cellContent += `<div style="text-align:right;font-size:10px;color:${pctColor};font-family:'DM Mono',monospace;font-weight:600;margin-top:2px">${totalH}h · ${pct}%</div>`;
        }
      }

      row += `<td style="width:180px;min-width:180px;${todayBg}padding:6px;border-right:1px solid var(--grey-200);border-bottom:1px solid var(--grey-200)">${cellContent}</td>`;
    });

    row += '</tr>';
    body += row;
  });

  document.getElementById('phBody').innerHTML = body;
  setTimeout(()=>syncHeadWidth('ph'),0);
}
