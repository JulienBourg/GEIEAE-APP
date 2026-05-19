// ═══════════════════════════════════════════════════════════════
// EXPORT XLSX TABLEAU RTE — via serveur Python local
// ═══════════════════════════════════════════════════════════════
async function exportRTEXlsx() {
  showToast('Connexion au serveur...', '');

  // Préparer les données à envoyer
  const payload = {
    projets,
    absences,
    horsProjets,
    ressources,
    heuresProjets,
    lignesProjets
  };

  try {
    // Vérifier que le serveur est actif
    const health = await fetch('http://localhost:5000/health', { method:'GET' })
      .catch(() => null);

    if (!health || !health.ok) {
      showToast('❌ Serveur introuvable — lancez serveur_rte.py', 'err');
      alert('Le serveur Python n\'est pas actif.\n\nLancez serveur_rte.py sur votre PC puis réessayez.\n\nDouble-cliquez sur serveur_rte.py ou utilisez la commande :\nC:\\Users\\bourg\\AppData\\Local\\Programs\\Python\\Python314\\python.exe serveur_rte.py');
      return;
    }

    showToast('Génération du fichier...', '');

    // Envoyer les données et récupérer le fichier
    const response = await fetch('http://localhost:5000/export-rte', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const err = await response.json();
      showToast('Erreur : ' + err.error, 'err');
      return;
    }

    // Télécharger le fichier
    const blob = await response.blob();
    const today = new Date();
    const fn = `RTE_GEIEAE_${today.getFullYear()}${String(today.getMonth()+1).padStart(2,'0')}${String(today.getDate()).padStart(2,'0')}.xlsx`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fn; a.click();
    URL.revokeObjectURL(url);
    showToast('✅ Export téléchargé !', 'ok');

  } catch(e) {
    showToast('❌ Erreur : ' + e.message, 'err');
  }
}



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
