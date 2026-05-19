// ═══════════════════════════════════════════════════════════════
// GANTT GÉNÉRIQUE
// ═══════════════════════════════════════════════════════════════
function buildGanttHead(start,nDays,headId){
  const dates=[];for(let i=0;i<nDays;i++)dates.push(addDays(start,i));
  const mb=monthBlocks(start,nDays);
  let mRow='<tr class="month-hdr"><th class="col-ressource"></th>';
  mb.forEach(b=>{mRow+=`<th colspan="${b.n}" style="text-align:center;padding:0 6px">${MONTHS_FR[b.m]} ${b.y}</th>`;});
  mRow+='</tr>';
  let dRow='<tr><th class="col-ressource" style="position:sticky;left:0;z-index:20;background:var(--navy);width:100px;min-width:100px;text-align:left;padding-left:8px;font-size:11px;font-weight:600;height:32px">Ressource</th>';
  dates.forEach(d=>{
    const ds=fmtISO(d);
    const we=isWE(d);const td=isToday(ds);
    const cls=we?'col-day we':td?'col-day today-h':'col-day';
    dRow+=`<th class="${cls}">${DAYS_FR[d.getDay()]}<br><span style="font-weight:400;opacity:.8;font-size:10px">${String(d.getDate()).padStart(2,'0')}</span></th>`;
  });
  dRow+='</tr>';
  document.getElementById(headId).innerHTML=mRow+dRow;
  return dates;
}

function buildGanttRow(rsc,dates,getCellFn){
  const full=rscName(rsc);
  const bCls=rsc.Entreprise==='Atlantique Etudes'?'badge-ae':'badge-eqos';
  const bLbl=rsc.Entreprise==='Atlantique Etudes'?'AE':'EQOS';
  const pays=rsc.Pays||'France';
  let row=`<tr><td class="td-ressource"><span style="font-weight:500">${full}</span><span class="badge ${bCls}">${bLbl}</span><div style="font-size:10px;color:var(--grey-500);margin-top:1px">${rsc.Poste} · 40h</div></td>`;
  dates.forEach(d=>{
    const ds=fmtISO(d);
    const we=isWE(d);const ferie=isFerie(ds,pays);const td=isToday(ds);
    if(we){row+=`<td class="td-cell we"></td>`;return;}
    if(ferie){row+=`<td class="td-cell ferie" title="${ferie.Libelle}">🎌</td>`;return;}
    const tdCls=td?' today-c':'';
    row+=getCellFn(full,ds,tdCls);
  });
  row+='</tr>';
  return row;
}
