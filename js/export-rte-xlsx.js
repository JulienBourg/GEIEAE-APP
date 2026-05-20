// ═══════════════════════════════════════════════════════════════
// EXPORT XLSX TABLEAU RTE
// ═══════════════════════════════════════════════════════════════
async function exportRTEXlsx() {
  showToast("Génération Excel...", "");

  try {
    if (!window.ExcelJS) {
      throw new Error("ExcelJS non chargé");
    }

    const workbook = new ExcelJS.Workbook();

    // =========================================================
    // 📦 CHARGEMENT TEMPLATE
    // =========================================================
    const response = await fetch("./templates/Template_RTE.xlsx");
    if (!response.ok) {
      throw new Error("Template introuvable");
    }

    const buffer = await response.arrayBuffer();
    await workbook.xlsx.load(buffer);

    const ws = workbook.getWorksheet("RTE") || workbook.getWorksheet(1);

    const today = new Date();

    // =========================================================
    // 🧠 OUTILS SEMAINES (équivalent Python)
    // =========================================================
    const COL_M = 13;
    // ⚠️ NE PAS utiliser new Date("YYYY-MM-DD") : parsé en UTC, décalage d'un jour en heure locale (ex: Luxembourg UTC+1/+2).
    // On construit la date en heure locale pour cohérence avec getMonday() qui utilise setHours(0,0,0,0).
    const S1_2026 = new Date(2025, 11, 29); // 29 décembre 2025 — lundi S1 2026 (ISO), heure locale

    function getMonday(d) {
      const date = new Date(d);
      const day = date.getDay();
      const diff = date.getDate() - day + (day === 0 ? -6 : 1);
      date.setDate(diff);
      date.setHours(0, 0, 0, 0);
      return date;
    }

    function getWeekCol(date) {
      const monday = getMonday(date);
      // Math.round neutralise le décalage DST hiver↔été (±1h → ±0.006 semaine)
      const weeksSince = Math.round(
        (monday - S1_2026) / (7 * 24 * 60 * 60 * 1000)
      );
      return COL_M + weeksSince;
    }

    // =========================================================
    // ✏️ DATE DE MISE À JOUR
    // =========================================================
    ws.getCell(5, 12).value = today.toLocaleDateString("fr-FR");

    // =========================================================
    // 🧾 HELPER WRITE SAFE
    // =========================================================
    function write(row, col, val) {
      if (val !== null && val !== undefined && val !== "") {
        ws.getCell(row, col).value = val;
      }
    }

    // =========================================================
    // 🔵 FIXED MAPPING (ABS + HP)
    // =========================================================
    const fixed = {
      "Eqos Energie|abs|LA": 9,
      "Eqos Energie|abs|LS": 10,
      "Eqos Energie|abs|CONV": 11,
      "Eqos Energie|hp|LA": 12,
      "Eqos Energie|hp|LS": 13,
      "Eqos Energie|hp|CONV": 14,
      "Atlantique Etudes|abs|LA": 15,
      "Atlantique Etudes|abs|LS": 16,
      "Atlantique Etudes|abs|CONV": 17,
      "Atlantique Etudes|hp|LA": 18,
      "Atlantique Etudes|hp|LS": 19,
      "Atlantique Etudes|hp|CONV": 20
    };

    const weeks = [];
    const endDate = new Date(2031, 11, 31); // Couvre tout le template jusqu'en S52-2031

    let cur = getMonday(today);

    while (cur <= endDate) {
      weeks.push({
        date: new Date(cur),
        col: getWeekCol(cur)
      });
      cur.setDate(cur.getDate() + 7);
    }

    // =========================================================
    // 🔴 FIXED BLOCK (ABS + HP)
    // =========================================================
    for (const wk of weeks) {
      for (const key in fixed) {
        const row = fixed[key];
        const [ent, type, poste] = key.split("|");

        let total = 0;

        ressources.forEach(r => {
          if (r.Entreprise !== ent || r.Poste !== poste) return;

          const nom = `${r.Nom} ${r.Prenom}`;
          const source = type === "abs" ? absences : horsProjets;

          source.forEach(item => {
            if (item.Ressource !== nom) return;

            const d = new Date(item.Date);
            const monday = getMonday(d);

            if (getWeekCol(monday) === wk.col) {
              total += Number(item.Heures || 0);
            }
          });
        });

        write(row, wk.col, total ? +(total / 40).toFixed(2) : null);
      }
    }

    // =========================================================
// 🟢 PROJETS
// =========================================================
const CATS = {
  LA: "LA ETP  (charge réelle GIE hors ss-traitance)",
  LS: "LS ETP  (charge réelle GIE hors ss-traitance)",
  CONV: "Conventionnement ETP  (charge réelle GIE hors ss-traitance)"
};

projets.forEach((proj, pi) => {

  const baseRow = 21 + pi * 3;

  ["LA", "LS", "CONV"].forEach((poste, ri) => {

    const row = baseRow + ri;

    // infos projet (une seule fois)
    if (ri === 0) {
      write(row, 4, proj.EOTP);
      write(row, 5, proj.Lot);
      write(row, 6, proj.Nom);
      write(row, 7, proj.Client);
      write(row, 8, proj.Fiabilite);
      write(row, 9, proj.Descriptif);
      const fmtDot = s => { if (!s) return null; const d = new Date(s); return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`; };
      write(row, 10, fmtDot(proj.DateDebut));
      write(row, 11, fmtDot(proj.DateTravaux));
    }

    write(row, 12, CATS[poste]);

    for (const wk of weeks) {

      let total = 0;

      lignesProjets.forEach(l => {

        if (l.projetId !== proj.id) return;

        // 🔥 filtre POSTE manquant
        const rsc = ressources.find(r =>
          `${r.Nom} ${r.Prenom}` === l.ressource
        );

        if (!rsc || rsc.Poste !== poste) return;

        heuresProjets.forEach(h => {

          if (h.ligneId !== l.id) return;

          const d = new Date(h.date + "T00:00:00");
          const monday = getMonday(d);

          if (getWeekCol(monday) === wk.col) {
            total += Number(h.heures || 0);
          }

        });

      });

      write(
        row,
        wk.col,
        total ? +(total / 40).toFixed(2) : null
      );

    }

  });

});

    // =========================================================
    // 📊 CAPACITÉS (lignes 1150-1152)
    // =========================================================
    const cap = {
      LA:   ressources.filter(r => r.Poste === "LA").length,
      LS:   ressources.filter(r => r.Poste === "LS").length,
      CONV: ressources.filter(r => r.Poste === "CONV").length,
    };

    for (const wk of weeks) {
      write(1150, wk.col, cap.LA);
      write(1151, wk.col, cap.LS);
      write(1152, wk.col, cap.CONV);
    }

    // =========================================================
    // 📤 EXPORT FINAL
    // =========================================================
    const out = await workbook.xlsx.writeBuffer();

    const blob = new Blob([out], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });

    const url = URL.createObjectURL(blob);

    const fileName =
      `RTE_GEIEAE_${today.getFullYear()}` +
      `${String(today.getMonth() + 1).padStart(2, "0")}` +
      `${String(today.getDate()).padStart(2, "0")}.xlsx`;

    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();

    URL.revokeObjectURL(url);

    showToast("✅ Export terminé", "ok");
  } catch (e) {
    console.error(e);
    showToast("❌ Erreur export : " + e.message, "err");
  }
}