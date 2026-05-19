// ═══════════════════════════════════════════════════════════════
// INIT — Point d'entrée de l'application
// ═══════════════════════════════════════════════════════════════

// INIT
// Synchronisation scroll horizontal : head suit le body pour les 4 vues
['abs','hp','pc','ph','pp'].forEach(id => {
  const hw = document.getElementById(id+'HeadWrap');
  const bw = document.getElementById(id+'BodyWrap');
  if (!hw || !bw) return;
  bw.addEventListener('scroll', () => { hw.scrollLeft = bw.scrollLeft; });
});

// Charger les données depuis SharePoint au démarrage
loadAllData();
