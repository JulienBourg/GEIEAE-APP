// ═══════════════════════════════════════════════════════════════
// EXPORT XLSX TABLEAU RTE
// ═══════════════════════════════════════════════════════════════
async function exportRTEXlsx2() {

  showToast('Génération Excel...', '');

  try {

    if (!window.ExcelJS) {
      throw new Error("ExcelJS n'est pas chargé. Ajoute le script CDN.");
    }

    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'RTE App';
    workbook.created = new Date();

    // =========================
    // FEUILLE SYNTHÈSE
    // =========================
    const ws = workbook.addWorksheet('Synthèse');

    ws.columns = [
      { header: 'Projet', key: 'projet', width: 30 },
      { header: 'Ressource', key: 'ressource', width: 25 },
      { header: 'Heures', key: 'heures', width: 12 },
      { header: 'Type', key: 'type', width: 18 }
    ];

    // =========================
    // STYLE HEADER
    // =========================
    const header = ws.getRow(1);

    header.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    header.alignment = { horizontal: 'center', vertical: 'middle' };
    header.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F4E79' }
    };

    header.height = 22;

    // =========================
    // DONNÉES
    // =========================

    (projets || []).forEach(p => {
      ws.addRow({
        projet: p.nom || p.name || '',
        ressource: '',
        heures: '',
        type: 'Projet'
      });
    });

    (heuresProjets || []).forEach(h => {
      ws.addRow({
        projet: h.projet || '',
        ressource: h.ressource || '',
        heures: h.heures || 0,
        type: 'Heures'
      });
    });

    (absences || []).forEach(a => {
      ws.addRow({
        projet: '',
        ressource: a.ressource || '',
        heures: a.heures || 0,
        type: 'Absence'
      });
    });

    (horsProjets || []).forEach(hp => {
      ws.addRow({
        projet: hp.projet || '',
        ressource: hp.ressource || '',
        heures: hp.heures || 0,
        type: 'Hors projet'
      });
    });

    // =========================
    // STYLE GLOBAL
    // =========================
    ws.eachRow((row, rowNumber) => {

      row.eachCell(cell => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        };

        cell.alignment = {
          vertical: 'middle',
          horizontal: 'left'
        };
      });

      // Zebra stripes
      if (rowNumber > 1) {
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: {
            argb: rowNumber % 2 === 0 ? 'FFF7F7F7' : 'FFFFFFFF'
          }
        };
      }
    });

    // =========================
    // FREEZE HEADER
    // =========================
    ws.views = [
      { state: 'frozen', ySplit: 1 }
    ];

    // =========================
    // EXPORT FICHIER
    // =========================
    const buffer = await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });

    const today = new Date();

    const fn = `RTE_GEIEAE_${today.getFullYear()}${
      String(today.getMonth() + 1).padStart(2, '0')
    }${String(today.getDate()).padStart(2, '0')}.xlsx`;

    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = fn;
    a.click();

    URL.revokeObjectURL(url);

    showToast('✅ Export Excel généré !', 'ok');

  } catch (e) {
    console.error(e);
    showToast('❌ Erreur export Excel : ' + e.message, 'err');
  }
}