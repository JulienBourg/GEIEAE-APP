// ═══════════════════════════════════════════════════════════════
// UTILITAIRES DATES
// ═══════════════════════════════════════════════════════════════
const DAYS_FR = ['Di','Lu','Ma','Me','Je','Ve','Sa'];
const MONTHS_FR = ['Jan','Fév','Mar','Avr','Mai','Jun','Jul','Aoû','Sep','Oct','Nov','Déc'];

function getMonday(d){
  const dt=new Date(d); const day=dt.getDay();
  dt.setDate(dt.getDate()-day+(day===0?-6:1)); dt.setHours(0,0,0,0); return dt;
}
function addDays(d,n){const dt=new Date(d);dt.setDate(dt.getDate()+n);return dt;}
function fmtISO(d){
  // Utiliser les méthodes locales pour éviter le décalage UTC
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return y+'-'+m+'-'+day;
}
function fmtDisp(s){const d=new Date(s+'T00:00:00');return d.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'});}
function isWE(d){return d.getDay()===0||d.getDay()===6;}
function isToday(s){return s===fmtISO(new Date());}
function isFerie(s, pays) {
  const result = joursFeries.find(f => {
    if (f.Date !== s) return false;
    if (!pays) return true;
    if (f.Pays === 'France+Luxembourg') return true;
    if (pays === 'France' && f.Pays === 'France') return true;
    if (pays === 'Luxembourg' && f.Pays === 'Luxembourg') return true;
    return false;
  }) || null;
  if (s === '2026-06-23') console.log('isFerie 23/06 pays='+pays+' result='+JSON.stringify(result));
  return result;
}
function rscName(r){return r.Prenom+' '+r.Nom;}

function monthBlocks(start,n){
  const blocks=[];let cur=new Date(start);let cm=cur.getMonth();let cnt=0;
  for(let i=0;i<n;i++){
    const d=addDays(start,i);
    if(d.getMonth()!==cm){blocks.push({m:cm,y:cur.getFullYear(),n:cnt});cm=d.getMonth();cur=d;cnt=1;}
    else cnt++;
  }
  blocks.push({m:cm,y:cur.getFullYear(),n:cnt});
  return blocks;
}
