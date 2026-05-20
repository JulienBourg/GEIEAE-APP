// ═══════════════════════════════════════════════════════════════
// BOUTON AIDE UTILISATEUR — ouverture de aide-utilisateur.html
// ═══════════════════════════════════════════════════════════════
//
// Ajouter ce bouton dans la topbar de index.html,
// à côté du bouton ℹ (workflow), avant </div> final :
//
//   <button onclick="openAide()"
//     title="Guide utilisateur"
//     style="
//       width:32px;height:32px;border-radius:50%;
//       background:rgba(255,255,255,.15);color:#fff;
//       border:1px solid rgba(255,255,255,.3);cursor:pointer;
//       font-size:14px;font-weight:700;flex-shrink:0;
//       display:flex;align-items:center;justify-content:center;
//       transition:background .15s,transform .15s;
//       margin-right:6px;
//     "
//     onmouseover="this.style.background='var(--green)';this.style.borderColor='var(--green)';this.style.transform='scale(1.1)'"
//     onmouseout="this.style.background='rgba(255,255,255,.15)';this.style.borderColor='rgba(255,255,255,.3)';this.style.transform='scale(1)'"
//   >?</button>
//
// ──────────────────────────────────────────────────────────────

function openAide() {
  // Ouvre le guide dans un nouvel onglet
  window.open('aide-utilisateur.html', '_blank');
}

// ── Optionnel : ouvrir en modal dans l'app ───────────────────
// Si vous préférez afficher l'aide dans une modal iframe
// plutôt que dans un nouvel onglet, utilisez cette version :

function openAideModal() {
  if (document.getElementById('aideModal')) {
    document.getElementById('aideModal').style.display = 'flex';
    return;
  }

  const overlay = document.createElement('div');
  overlay.id = 'aideModal';
  overlay.style.cssText = `
    display:flex; position:fixed; inset:0; z-index:9998;
    background:rgba(10,20,40,.72); backdrop-filter:blur(4px);
    align-items:center; justify-content:center;
  `;
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeAideModal();
  });

  overlay.innerHTML = `
    <div style="
      width:92vw; max-width:1100px; height:88vh;
      background:#fff; border-radius:14px; overflow:hidden;
      box-shadow:0 24px 80px rgba(0,0,0,.4);
      display:flex; flex-direction:column;
      animation: aideSlideIn .22s cubic-bezier(.4,0,.2,1);
    ">
      <div style="
        background:var(--navy); color:#fff;
        display:flex; align-items:center; gap:12px;
        padding:14px 20px; flex-shrink:0;
      ">
        <span style="font-size:16px">📖</span>
        <div style="flex:1">
          <div style="font-size:14px;font-weight:700">Guide utilisateur</div>
          <div style="font-size:11px;color:rgba(255,255,255,.5);margin-top:1px">Gestion de la Charge – EQOS / Atlantique Etudes</div>
        </div>
        <button onclick="closeAideModal()"
          style="background:rgba(255,255,255,.12);border:none;cursor:pointer;
            width:30px;height:30px;border-radius:6px;color:#fff;font-size:20px;
            display:flex;align-items:center;justify-content:center;"
          onmouseover="this.style.background='rgba(255,255,255,.25)'"
          onmouseout="this.style.background='rgba(255,255,255,.12)'"
        >×</button>
      </div>
      <iframe src="aide-utilisateur.html" style="flex:1;border:none;width:100%;"></iframe>
    </div>
  `;

  // Keyframe animation
  if (!document.getElementById('aideModalStyles')) {
    const style = document.createElement('style');
    style.id = 'aideModalStyles';
    style.textContent = '@keyframes aideSlideIn{from{opacity:0;transform:translateY(18px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}';
    document.head.appendChild(style);
  }

  document.body.appendChild(overlay);
}

function closeAideModal() {
  const modal = document.getElementById('aideModal');
  if (modal) modal.style.display = 'none';
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeAideModal();
});
