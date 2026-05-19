// ═══════════════════════════════════════════════════════════════
// PARAMS NAV
// ═══════════════════════════════════════════════════════════════
function showParams(id){
  document.querySelectorAll('.params-nav').forEach(b=>b.classList.remove('active'));
  document.querySelectorAll('[id^="params-"]').forEach(d=>{d.style.display='none';});
  document.getElementById('params-'+id).style.display='flex';
  document.querySelectorAll('.params-nav').forEach(b=>{
    if(b.getAttribute('onclick')===`showParams('${id}')`) b.classList.add('active');
  });
}
