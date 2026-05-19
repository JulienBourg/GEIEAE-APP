// ═══════════════════════════════════════════════════════════════
// PLAN DE CHARGE
// ═══════════════════════════════════════════════════════════════
let pcStart=getMonday(new Date());
const PC_WEEKS=16;

function pcNav(w){pcStart=addDays(pcStart,w*7);renderPC();}
function pcToday(){pcStart=getMonday(new Date());renderPC();}

function renderPC(){
  const fEnt=document.getElementById('pcFilterEnt').value;
  const rsc=ressources.filter(r=>!fEnt||r.Entreprise===fEnt);
  // Calcul largeur colonne Ressource selon contenu le plus long
  const maxLen = rsc.reduce((mx,r)=>{const len=(rscName(r)+' '+r.Poste+' · 40h').length;return len>mx?len:mx;},0);
  const pcRscW = Math.max(140, Math.min(220, 60 + maxLen * 7));
  const pcRscWpx = pcRscW + 'px';
  // Largeur disponible pour les colonnes semaine = largeur du wrap - colonne ressource
  const wrapW = document.getElementById('pcWrap').clientWidth || 900;
  const availW = Math.max(wrapW - pcRscW - 2, PC_WEEKS * 60);
  const colWeekW = Math.max(60, Math.floor(availW / PC_WEEKS));
  const tableW = pcRscW + PC_WEEKS * colWeekW;
  document.getElementById('pcTable').style.width = tableW + 'px';
  document.getElementById('pcTable').style.minWidth = tableW + 'px';
  const wStyle = `position:sticky;left:0;z-index:5;background:#fff;width:${pcRscWpx};min-width:${pcRscWpx};max-width:${pcRscWpx};overflow:hidden`;
  const wStyleHead = `position:sticky;left:0;z-index:20;background:var(--navy);width:${pcRscWpx};min-width:${pcRscWpx};max-width:${pcRscWpx}`;
  const wStyleMonth = `position:sticky;left:0;z-index:20;background:var(--navy-dark);width:${pcRscWpx};min-width:${pcRscWpx};max-width:${pcRscWpx}`;
  const weeks=[];
  for(let i=0;i<PC_WEEKS;i++) weeks.push(addDays(pcStart,i*7));
  const end=addDays(pcStart,(PC_WEEKS*7)-1);
  document.getElementById('pcWeekLabel').textContent=
    `${pcStart.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})} — ${end.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}`;

  // Head — ligne mois
  const weeksByMonth={};
  weeks.forEach(w=>{const mk=w.getFullYear()+'-'+w.getMonth();weeksByMonth[mk]=(weeksByMonth[mk]||0)+1;});
  let mRow=`<tr class="month-hdr"><th style="${wStyleMonth}"></th>`;
  Object.entries(weeksByMonth).forEach(([mk,cnt])=>{
    const [y,m]=mk.split('-');
    mRow+=`<th colspan="${cnt}" style="text-align:center;padding:0 4px;font-size:9px">${MONTHS_FR[parseInt(m)]} ${y}</th>`;
  });
  mRow+='</tr>';

  let hRow=`<tr><th style="${wStyleHead};text-align:left;padding-left:14px;font-size:11px;font-weight:600;height:32px;border-right:1px solid rgba(255,255,255,.1)">Ressource</th>`;
  weeks.forEach(w=>{
    hRow+=`<th class="col-day" style="width:${colWeekW}px;min-width:${colWeekW}px;max-width:${colWeekW}px;font-size:9px;padding:2px 1px;line-height:1.3;white-space:nowrap">S${getWeekNum(w)}<br><span style="opacity:.8;font-size:8px">${w.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'})}</span></th>`;
  });
  hRow+='</tr>';
  document.getElementById('pcHead').innerHTML=mRow+hRow;

  // Body
  let html=rsc.map(r=>{
    const full=rscName(r);
    const bCls=r.Entreprise==='Atlantique Etudes'?'badge-ae':'badge-eqos';
    const bLbl=r.Entreprise==='Atlantique Etudes'?'AE':'EQOS';
    let row=`<tr><td style="${wStyle};height:40px;padding:4px 14px;border-right:2px solid var(--grey-200);font-size:12px;vertical-align:middle"><span style="font-weight:500">${full}</span><span class="badge ${bCls}">${bLbl}</span><div style="font-size:10px;color:var(--grey-500);margin-top:1px">${r.Poste} · 40h</div></td>`;
    weeks.forEach(w=>{
      // Calcul heures abs + hp + fériés + projets pour cette semaine
      let totalAbs=0,totalHP=0,totalProj=0,totalFerie=0;
      const pays=r.Pays||'France';
      const lignesRsc=lignesProjets.filter(l=>l.ressource===full);
      for(let d=0;d<5;d++){
        const ds=fmtISO(addDays(w,d));
        if(isFerie(ds,pays)) { totalFerie+=8; continue; } // jour férié = 8h occupées
        const abs=absences.find(a=>a.Ressource===full&&a.Date===ds);
        if(abs) totalAbs+=abs.Heures;
        const hp=horsProjets.find(a=>a.Ressource===full&&a.Date===ds);
        if(hp) totalHP+=hp.Heures;
        lignesRsc.forEach(l=>{
          const h=heuresProjets.find(x=>x.ligneId===l.id&&x.date===ds);
          if(h) totalProj+=h.heures;
        });
      }
      const total=totalAbs+totalHP+totalProj+totalFerie;
      const cap = 40; // capacité fixe 40h/semaine, jamais réduite
      const pct=cap>0?Math.round((total/cap)*100):0;
      let cellBg='#fff',color='var(--grey-400)';
      if(total>0&&pct<80){cellBg='rgba(26,122,74,0.15)';color='var(--green)';}
      if(pct>=80&&pct<100){cellBg='rgba(240,120,0,0.15)';color='var(--orange)';}
      if(pct>=100){cellBg='rgba(204,32,32,0.15)';color='var(--red)';}
      row+=`<td style="width:${colWeekW}px;min-width:${colWeekW}px;max-width:${colWeekW}px;text-align:center;vertical-align:middle;border-right:1px solid var(--grey-200);height:36px;background:${cellBg}">
        ${total>0?`<span style="color:${color};font-size:11px;font-weight:700;font-family:'DM Mono',monospace">${pct}%</span>`:''}
      </td>`;
    });
    row+='</tr>';
    return row;
  }).join('');
  document.getElementById('pcBody').innerHTML=html;
  setTimeout(()=>syncHeadWidth('pc'),0);
}

function getWeekNum(d){
  const dt=new Date(d);dt.setHours(0,0,0,0);
  dt.setDate(dt.getDate()+4-(dt.getDay()||7));
  const yearStart=new Date(dt.getFullYear(),0,1);
  return Math.ceil((((dt-yearStart)/86400000)+1)/7);
}
