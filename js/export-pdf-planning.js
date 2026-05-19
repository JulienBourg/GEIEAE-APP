// ═══════════════════════════════════════════════════════════════
// EXPORT PDF
// ═══════════════════════════════════════════════════════════════
async function exportTableToPDF(elementId, filename, title, subtitle) {
  const el = document.getElementById(elementId);
  if (!el) { showToast('Élément introuvable', 'err'); return; }
  showToast('Génération du PDF...', '');
  try {
    const canvas = await html2canvas(el, {
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      scrollX: 0,
      scrollY: 0,
      windowWidth: el.scrollWidth,
      windowHeight: el.scrollHeight,
      width: el.scrollWidth,
      height: el.scrollHeight,
    });
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const margin = 10;

    // En-tête
    pdf.setFillColor(26, 58, 92);
    pdf.rect(0, 0, pageW, 18, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(13);
    pdf.setFont('helvetica', 'bold');
    pdf.text(title, margin, 11);
    pdf.setFontSize(9);
    pdf.setFont('helvetica', 'normal');
    pdf.text(subtitle, margin, 16);
    pdf.text('GEIE AE — ' + new Date().toLocaleDateString('fr-FR'), pageW - margin, 11, {align:'right'});

    // Image du tableau
    const imgData = canvas.toDataURL('image/png');
    const availW = pageW - margin * 2;
    const availH = pageH - 22 - margin;
    const imgW = canvas.width;
    const imgH = canvas.height;
    const ratio = Math.min(availW / imgW, availH / imgH);
    const finalW = imgW * ratio;
    const finalH = imgH * ratio;
    pdf.addImage(imgData, 'PNG', margin, 20, finalW, finalH);
    pdf.save(filename);
    showToast('PDF exporté !', 'ok');
  } catch(e) {
    console.error(e);
    showToast('Erreur export PDF', 'err');
  }
}




function exportPlanningHebdoPDF() {
  const semaine = document.getElementById('phWeekLabel').textContent;
  const fEnt    = document.getElementById('phFilterEnt').value;
  const fPoste  = document.getElementById('phFilterPoste')?.value || '';
  const title   = 'Planning ressources — ' + semaine;
  const subtitle = [fEnt||'Toutes entreprises', fPoste||'Tous postes', 'GEIE AE'].join(' · ');
  exportPlanningPDF('phHeadTable', 'phTable', title, subtitle,
    'planning_ressources_S' + getWeekNum(phStart) + '_' + phStart.getFullYear() + '.pdf');
}

async function exportPlanningPDF(headTableId, bodyTableId, title, subtitle, filename) {
  showToast('Génération du PDF...', '');
  try {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
    const pageW  = pdf.internal.pageSize.getWidth();
    const pageH  = pdf.internal.pageSize.getHeight();
    const margin = 8;
    const hdrH   = 18;
    const SCALE  = 1.5;

    const headTable = document.getElementById(headTableId);
    const bodyTable = document.getElementById(bodyTableId);
    if (!headTable || !bodyTable) { showToast('Table introuvable','err'); return; }

    const rows = Array.from(bodyTable.querySelectorAll('tbody tr'));
    if (rows.length === 0) { showToast('Aucune donnée','err'); return; }

    // Scroll à 0
    const headWrap = headTable.closest('.planning-head-wrap');
    const bodyWrap = bodyTable.closest('.planning-body-wrap');
    const savedHeadScroll = headWrap ? headWrap.scrollLeft : 0;
    const savedBodyScroll = bodyWrap ? bodyWrap.scrollLeft : 0;
    if (headWrap) headWrap.scrollLeft = 0;
    if (bodyWrap) bodyWrap.scrollLeft = 0;

    // ── Construire une table unique hors-écran (thead + tbody) ──
    const fullW = Math.max(headTable.scrollWidth, bodyTable.scrollWidth);

    const wrapper = document.createElement('div');
    wrapper.style.cssText = [
      'position:fixed',
      'top:0',
      'left:-' + (fullW + 20) + 'px',
      'width:' + fullW + 'px',
      'background:#fff',
      'z-index:99999'
    ].join(';');

    const tbl = document.createElement('table');
    tbl.style.cssText = 'border-collapse:collapse;table-layout:fixed;width:' + fullW + 'px;font-family:DM Sans,sans-serif;font-size:12px';

    // Cloner thead
    const theadClone = headTable.querySelector('thead').cloneNode(true);
    // Forcer les styles sur chaque th (html2canvas ignore les feuilles de style)
    Array.from(theadClone.querySelectorAll('th')).forEach(th => {
      th.style.background   = th.classList.contains('col-ressource') ? '#1a3a5c' : (th.style.background || '#1a3a5c');
      th.style.color        = '#ffffff';
      th.style.fontWeight   = '600';
      th.style.fontSize     = '11px';
      th.style.height       = '40px';
      th.style.verticalAlign = 'middle';
      th.style.whiteSpace   = 'nowrap';
      th.style.borderRight  = '1px solid rgba(255,255,255,0.15)';
      th.style.position     = 'relative'; // neutralise sticky
      if (th.classList.contains('col-ressource')) {
        th.style.width      = '160px';
        th.style.minWidth   = '160px';
        th.style.paddingLeft = '14px';
        th.style.textAlign  = 'left';
        th.style.borderRight = '2px solid #d1d5db';
      } else {
        th.style.textAlign  = 'center';
        th.style.width      = '180px';
        th.style.minWidth   = '180px';
      }
    });
    tbl.appendChild(theadClone);

    // Cloner tbody
    const tbodyClone = bodyTable.querySelector('tbody').cloneNode(true);
    const tbodyRows  = Array.from(tbodyClone.querySelectorAll('tr'));
    tbodyRows.forEach((tr, i) => {
      tr.style.verticalAlign = 'top';
      Array.from(tr.querySelectorAll('td')).forEach(td => {
        td.style.borderBottom = (i === tbodyRows.length - 1) ? 'none' : '1px solid #d1d5db';
        if (td.classList.contains('td-ressource')) {
          td.style.position   = 'relative';
          td.style.borderRight = '2px solid #d1d5db';
        }
      });
    });
    tbl.appendChild(tbodyClone);

    wrapper.appendChild(tbl);
    document.body.appendChild(wrapper);

    // Mesurer theadH AVANT de retirer du DOM
    const theadH_px     = theadClone.getBoundingClientRect().height || 40;
    const rowHeights_px = tbodyRows.map(tr => tr.getBoundingClientRect().height);

    const canvasFull = await html2canvas(tbl, {
      scale: SCALE, useCORS: true, backgroundColor: '#ffffff',
      width: fullW, height: tbl.scrollHeight,
      onclone: () => {}
    });

    document.body.removeChild(wrapper);

    // Restaurer scroll
    if (headWrap) headWrap.scrollLeft = savedHeadScroll;
    if (bodyWrap) bodyWrap.scrollLeft = savedBodyScroll;

    // ── Mise en page PDF ──
    const availW     = pageW - margin * 2;
    const ratio      = availW / (canvasFull.width / SCALE);
    const headH_mm   = theadH_px * ratio;
    const theadH_canvas = Math.round(theadH_px * SCALE);
    const availBodyH = pageH - hdrH - headH_mm - margin - 4;

    const rowHeights_mm = rowHeights_px.map(h => h * ratio);

    // Découpage en pages (jamais couper une row)
    const pages = [];
    let pageRows = [], pageUsed = 0;
    rows.forEach((_, i) => {
      const rh = rowHeights_mm[i];
      if (pageRows.length > 0 && pageUsed + rh > availBodyH) {
        pages.push([...pageRows]);
        pageRows = [i]; pageUsed = rh;
      } else {
        pageRows.push(i); pageUsed += rh;
      }
    });
    if (pageRows.length > 0) pages.push(pageRows);
    const totalPages = pages.length;

    // Position Y canvas de chaque row (commence après theadH_canvas)
    const rowY_canvas = [];
    let cumY = 0;
    rowHeights_px.forEach(h => { rowY_canvas.push(theadH_canvas + Math.round(cumY * SCALE)); cumY += h; });

    function drawPageHeader(pageNum) {
      pdf.setFillColor(26, 58, 92);
      pdf.rect(0, 0, pageW, hdrH, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(12); pdf.setFont('helvetica', 'bold');
      pdf.text(title, margin, 10);
      pdf.setFontSize(8); pdf.setFont('helvetica', 'normal');
      pdf.text(subtitle, margin, 15);
      pdf.text('Page ' + pageNum + '/' + totalPages + ' — ' + new Date().toLocaleDateString('fr-FR'), pageW - margin, 10, {align:'right'});
    }

    // Encoder le thead une seule fois pour toutes les pages
    const headSlice = document.createElement('canvas');
    headSlice.width = canvasFull.width; headSlice.height = theadH_canvas;
    headSlice.getContext('2d').drawImage(canvasFull, 0, 0, canvasFull.width, theadH_canvas, 0, 0, canvasFull.width, theadH_canvas);
    const headJpeg = headSlice.toDataURL('image/jpeg', 1.0);

    for (let pi = 0; pi < pages.length; pi++) {
      if (pi > 0) pdf.addPage();
      drawPageHeader(pi + 1);

      let yPos = hdrH + 2;

      // Thead (image pré-encodée)
      pdf.addImage(headJpeg, 'JPEG', margin, yPos, availW, headH_mm);
      yPos += headH_mm + 1;

      // Tbody slice
      const pageRowIdxs = pages[pi];
      const firstRow    = pageRowIdxs[0];
      const lastRow     = pageRowIdxs[pageRowIdxs.length - 1];
      const srcY = rowY_canvas[firstRow];
      const srcH = Math.round(rowY_canvas[lastRow] + rowHeights_px[lastRow] * SCALE) - rowY_canvas[firstRow];

      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvasFull.width; sliceCanvas.height = srcH;
      sliceCanvas.getContext('2d').drawImage(canvasFull, 0, srcY, canvasFull.width, srcH, 0, 0, canvasFull.width, srcH);

      const sliceH_mm = pageRowIdxs.reduce((s, i) => s + rowHeights_mm[i], 0);
      pdf.addImage(sliceCanvas.toDataURL('image/jpeg', 1.0), 'JPEG', margin, yPos, availW, sliceH_mm);
    }

    pdf.save(filename);
    showToast('PDF exporté — ' + totalPages + ' page(s) !', 'ok');
  } catch(e) {
    console.error(e);
    showToast('Erreur export PDF : ' + e.message, 'err');
  }
}
