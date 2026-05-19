// ═══════════════════════════════════════════════════════════════
// TIMELINE PDF EXPORT
// ═══════════════════════════════════════════════════════════════
function exportTimelinePDF() {
  const { jsPDF } = window.jspdf;

  const fEnt  = document.getElementById('tlFilterEnt').value;
  const fType = document.getElementById('tlFilterType').value;
  const projFiltered = projets.filter(p => {
    if (fEnt  && p.Entite !== fEnt)  return false;
    if (fType && p.Type   !== fType) return false;
    return true;
  }).filter(p => tlProjectRange(p) !== null);

  if (!projFiltered.length) { showToast('Aucun projet avec des dates à exporter', 'err'); return; }

  // ── Plage globale : min/max de tous les projets visibles ──
  let allDates = [];
  projFiltered.forEach(p => {
    const r = tlProjectRange(p);
    if (r) { allDates.push(r.debut); allDates.push(r.fin); }
  });
  allDates.sort();
  const gStart = allDates[0];
  const gEnd   = allDates[allDates.length - 1];

  // ── Colonnes selon la vue courante ──
  const cols = [];
  if (tlView === 'week') {
    let cur = getMonday(new Date(gStart + 'T00:00:00'));
    const end = new Date(gEnd + 'T00:00:00');
    while (cur <= addDays(end, 6)) {
      const ven = addDays(cur, 6);
      cols.push({ label: 'S' + getWeekNum(cur), labelSub: cur.toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}), dateDebut: fmtISO(cur), dateFin: fmtISO(ven) });
      cur = addDays(cur, 7);
    }
  } else {
    let cur = new Date(new Date(gStart + 'T00:00:00').getFullYear(), new Date(gStart + 'T00:00:00').getMonth(), 1);
    const end = new Date(gEnd + 'T00:00:00');
    while (cur <= end) {
      const fin = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      cols.push({ label: MONTHS_FR[cur.getMonth()] + ' ' + cur.getFullYear(), labelSub: '', dateDebut: fmtISO(new Date(cur)), dateFin: fmtISO(fin) });
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
  }

  // ── Dimensions ──
  const margin   = 8;
  const hdrH     = 16;
  const thH      = tlView === 'week' ? 18 : 12; // 2 lignes si semaine, 1 si mois
  const COL_NOM  = 60, COL_TYPE = 18, COL_RESP = 35, COL_CLI = 35;
  const fixedW   = COL_NOM + COL_TYPE + COL_RESP + COL_CLI;
  const colW     = tlView === 'week' ? 10 : 18;
  const ROW_H    = 8;
  const FONT_SM  = 6;

  const pgW    = fixedW + cols.length * colW;
  const pageW  = margin * 2 + pgW;
  const pageH  = 420; // A3 landscape height in mm

  const availBodyH  = pageH - hdrH - thH - margin * 2;
  const rowsPerPage = Math.floor(availBodyH / ROW_H);
  const rowGroups   = [];
  for (let i = 0; i < projFiltered.length; i += rowsPerPage)
    rowGroups.push(projFiltered.slice(i, i + rowsPerPage));
  const totalPages = rowGroups.length;

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: [pageW, pageH] });

  // Couleurs
  const NAVY   = [26, 58, 92];
  const NAVY_D = [18, 40, 65];
  const GREY_L = [230, 234, 240];
  const GREY_B = [180, 190, 205];
  const WHITE  = [255, 255, 255];
  const ORANGE = [240, 120, 0];
  const posteColorsRGB = { LA:[26,58,92], LS:[26,122,74], CONV:[240,120,0], Mixte:[124,58,237], Autre:[100,116,139] };

  const scaleLabel = tlView === 'week' ? 'hebdomadaire' : 'mensuelle';
  const filterLabel = [fEnt||'Toutes entreprises', fType||'Tous domaines'].join(' · ');

  // dateToX
  const d2x = (ds, clamp) => {
    if (!ds) return null;
    for (let i = 0; i < cols.length; i++) {
      const c = cols[i];
      if (ds >= c.dateDebut && ds <= c.dateFin) {
        const tot = (new Date(c.dateFin+'T00:00:00') - new Date(c.dateDebut+'T00:00:00')) / 86400000 + 1;
        const off = (new Date(ds+'T00:00:00') - new Date(c.dateDebut+'T00:00:00')) / 86400000;
        return margin + fixedW + i * colW + (off / tot) * colW;
      }
    }
    if (!clamp) return null;
    if (ds < cols[0].dateDebut) return margin + fixedW;
    return margin + fixedW + cols.length * colW;
  };

  function drawHeader(pgNum) {
    pdf.setFillColor(...NAVY);
    pdf.rect(0, 0, pageW, hdrH, 'F');
    pdf.setTextColor(...WHITE);
    pdf.setFontSize(11); pdf.setFont('helvetica', 'bold');
    pdf.text('Timeline — ' + filterLabel, margin, 10);
    pdf.setFontSize(7); pdf.setFont('helvetica', 'normal');
    pdf.text('GEIE AE — ' + new Date().toLocaleDateString('fr-FR') + ' · Vue ' + scaleLabel +
      (totalPages > 1 ? ' · Page ' + pgNum + '/' + totalPages : ''), pageW - margin, 12, { align: 'right' });
  }

  function drawThead(Y) {
    // Ligne mois (vue semaine) ou directement labels (vue mois)
    if (tlView === 'week') {
      pdf.setFillColor(...NAVY_D);
      pdf.rect(margin, Y, pgW, thH / 2, 'F');
      const mGroups = [];
      cols.forEach((c, i) => {
        const mo = c.dateDebut.slice(0, 7);
        if (!mGroups.length || mGroups[mGroups.length-1].key !== mo)
          mGroups.push({ key: mo, label: MONTHS_FR[parseInt(mo.slice(5,7))-1] + ' ' + mo.slice(0,4), count: 1, si: i });
        else mGroups[mGroups.length-1].count++;
      });
      pdf.setTextColor(...WHITE); pdf.setFontSize(6); pdf.setFont('helvetica', 'bold');
      mGroups.forEach(g => pdf.text(g.label, margin + fixedW + g.si * colW + g.count * colW / 2, Y + thH / 4 + 1.5, { align: 'center' }));
    }

    const Y2 = tlView === 'week' ? Y + thH / 2 : Y;
    const thH2 = tlView === 'week' ? thH / 2 : thH;
    pdf.setFillColor(...NAVY);
    pdf.rect(margin, Y2, pgW, thH2, 'F');
    pdf.setTextColor(...WHITE); pdf.setFontSize(6); pdf.setFont('helvetica', 'bold');
    [
      { l: 'Projet',       w: COL_NOM,  x: margin },
      { l: 'Type',         w: COL_TYPE, x: margin + COL_NOM },
      { l: 'Responsable',  w: COL_RESP, x: margin + COL_NOM + COL_TYPE },
      { l: 'Client',       w: COL_CLI,  x: margin + COL_NOM + COL_TYPE + COL_RESP }
    ].forEach(f => pdf.text(f.l, f.x + f.w / 2, Y2 + thH2 / 2 + 1.5, { align: 'center' }));

    pdf.setFontSize(5); pdf.setFont('helvetica', 'normal');
    cols.forEach((c, i) => {
      const cx = margin + fixedW + i * colW + colW / 2;
      if (tlView === 'week') {
        pdf.text(c.label, cx, Y2 + 2.5, { align: 'center' });
        pdf.text(c.labelSub, cx, Y2 + 5.5, { align: 'center' });
      } else {
        pdf.text(c.label, cx, Y2 + thH2 / 2 + 1.5, { align: 'center' });
      }
    });
    pdf.setDrawColor(...GREY_B); pdf.setLineWidth(0.1);
    for (let i = 0; i <= cols.length; i++)
      pdf.line(margin + fixedW + i * colW, Y2, margin + fixedW + i * colW, Y2 + thH2);
    [COL_NOM, COL_TYPE, COL_RESP].reduce((acc, w) => {
      pdf.line(margin + acc, Y2, margin + acc, Y2 + thH2); return acc + w;
    }, 0);
    return Y2 + thH2;
  }

  function drawRows(rowGroup, bodyTop, globalOffset) {
    const grpH = rowGroup.length * ROW_H;
    rowGroup.forEach((p, li) => {
      const idx  = globalOffset + li;
      const rowY = bodyTop + li * ROW_H;
      pdf.setFillColor(...(idx % 2 === 0 ? WHITE : [245, 247, 250]));
      pdf.rect(margin, rowY, pgW, ROW_H, 'F');
      pdf.setDrawColor(...GREY_L); pdf.setLineWidth(0.1);
      pdf.line(margin, rowY + ROW_H, margin + pgW, rowY + ROW_H);

      const tY = rowY + ROW_H / 2 + FONT_SM * 0.35;
      const catRGB = posteColorsRGB[p.Type] || [100,116,139];

      pdf.setFontSize(FONT_SM); pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...NAVY);
      pdf.text(pdf.splitTextToSize(p.Nom||'—', COL_NOM - 3)[0], margin + 2, tY);

      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(...catRGB);
      pdf.text(p.Type||'—', margin + COL_NOM + COL_TYPE / 2, tY, { align: 'center' });

      pdf.setFont('helvetica', 'normal');
      pdf.setTextColor(60, 80, 110);
      pdf.text(pdf.splitTextToSize(p.Responsable||'—', COL_RESP - 2)[0], margin + COL_NOM + COL_TYPE + 2, tY);
      pdf.text(pdf.splitTextToSize(p.Client||'—', COL_CLI - 2)[0], margin + COL_NOM + COL_TYPE + COL_RESP + 2, tY);

      pdf.setDrawColor(...GREY_L);
      [COL_NOM, COL_TYPE, COL_RESP].reduce((acc, w) => {
        pdf.line(margin + acc, rowY, margin + acc, rowY + ROW_H); return acc + w;
      }, 0);
      pdf.line(margin + fixedW, rowY, margin + fixedW, rowY + ROW_H);

      // ── Barre Gantt ──
      const range = tlProjectRange(p);
      if (range) {
        // x1 = début de la première colonne touchée, x2 = fin de la dernière colonne touchée
        const firstCol = cols.findIndex(c => range.debut <= c.dateFin && range.fin >= c.dateDebut);
        const lastCol  = cols.map((c,i) => range.debut <= c.dateFin && range.fin >= c.dateDebut ? i : -1).filter(i => i >= 0).pop();
        const x1 = firstCol >= 0 ? margin + fixedW + firstCol * colW : null;
        const x2 = lastCol  >= 0 ? margin + fixedW + (lastCol + 1) * colW : null;
        if (x1 !== null && x2 !== null && x2 > x1) {
          const bH = ROW_H * 0.55;
          const bY = rowY + (ROW_H - bH) / 2;
          // Couleur pâle = mélange 85% blanc + 15% couleur (identique à l'écran catColor+'28')
          const paleR = Math.round(255 * 0.84 + catRGB[0] * 0.16);
          const paleG = Math.round(255 * 0.84 + catRGB[1] * 0.16);
          const paleB = Math.round(255 * 0.84 + catRGB[2] * 0.16);
          pdf.setFillColor(paleR, paleG, paleB);
          pdf.roundedRect(x1, bY, x2 - x1, bH, 0.8, 0.8, 'F');

          // ── Heures dans la barre (couleur foncée sur fond pâle) ──
          cols.forEach((c, ci) => {
            const hours = tlCalcHours(p, c);
            if (hours <= 0) return;
            const cx = margin + fixedW + ci * colW + colW / 2;
            if (cx < x1 || cx > x2) return;
            pdf.setFontSize(4.5); pdf.setFont('helvetica', 'bold');
            pdf.setTextColor(...catRGB);
            const label = (hours % 1 === 0 ? hours : parseFloat(hours.toFixed(1))) + 'h';
            pdf.text(label, cx, rowY + ROW_H / 2 + 1.5, { align: 'center' });
          });
        }
      }

      pdf.setDrawColor(...GREY_L);
      for (let i = 1; i < cols.length; i++)
        pdf.line(margin + fixedW + i * colW, rowY, margin + fixedW + i * colW, rowY + ROW_H);
    });
    // Bordures
    pdf.setDrawColor(...GREY_B); pdf.setLineWidth(0.2);
    pdf.rect(margin, bodyTop, pgW, grpH);
    pdf.setDrawColor(...NAVY_D); pdf.setLineWidth(0.4);
    pdf.line(margin + fixedW, bodyTop - thH, margin + fixedW, bodyTop + grpH);
  }

  // ── Rendu ──
  rowGroups.forEach((rowGroup, pi) => {
    if (pi > 0) pdf.addPage([pageW, pageH]);
    drawHeader(pi + 1);
    const bodyTop = drawThead(hdrH + margin);
    drawRows(rowGroup, bodyTop, pi * rowsPerPage);
  });

  const dateStr = new Date().toLocaleDateString('fr-FR').replace(/\//g, '-');
  pdf.save('timeline_' + (fEnt || 'tous').replace(/[^a-z0-9]/gi, '_') + '_' + tlView + '_' + dateStr + '.pdf');
  showToast('PDF Timeline exporté' + (totalPages > 1 ? ' — ' + totalPages + ' pages' : '') + ' !', 'ok');
}
