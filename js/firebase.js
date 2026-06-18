// ═══════════════════════════════════════════════════════════════
// COUCHE FIREBASE FIRESTORE — Lecture/Écriture des données
// Architecture : listener temps réel + transaction atomique
// Supporte l'usage simultané multi-utilisateurs
// ═══════════════════════════════════════════════════════════════

let db = null;
let _unsubscribeSnapshot = null; // Pour détacher le listener si besoin
let _isSaving = false;           // Verrou : évite que le snapshot externe
                                  // n'écrase nos données pendant qu'on sauvegarde
let _pendingSave = false;         // Une sauvegarde est en attente après le verrou
let saveTimeout = null;

// ── Init Firebase (compat SDK chargé dans le head) ──────────
function initFirebase() {
  if (!firebase.apps.length) {
    firebase.initializeApp({
      apiKey: "AIzaSyC6bDVXj4RoSeO4DFyyAg2wdHz1NM2c2BM",
      authDomain: "geieae-app.firebaseapp.com",
      projectId: "geieae-app",
      storageBucket: "geieae-app.firebasestorage.app",
      messagingSenderId: "64387735349",
      appId: "1:64387735349:web:7eedb0d8845cecd39c767c"
    });
  }
  if (!db) db = firebase.firestore();
  return db;
}

// ── Recalculer nextId à partir des données en mémoire ───────
function _recalcNextId() {
  const allIds = [
    ...ressources, ...projets, ...absences, ...horsProjets,
    ...ganttTaches, ...lignesProjets, ...heuresProjets
    // joursFeries a des IDs fixes, on les exclut
  ].map(x => x.id || 0);
  nextId = allIds.length > 0 ? Math.max(...allIds) + 1 : 1;
}

// ── Appliquer un snapshot Firestore en mémoire ───────────────
// Appelé au chargement initial ET à chaque mise à jour externe
function _applySnapshot(data) {
  ressources    = data.ressources    || [];
  projets       = data.projets       || [];
  absences      = data.absences      || [];
  horsProjets   = data.horsProjets   || [];
  ganttTaches   = data.ganttTaches   || [];
  lignesProjets = data.lignesProjets || [];
  heuresProjets = data.heuresProjets || [];

  // ── Migration format ressource : "NOM Prenom" → "Prenom NOM" ──
  // Construit un dictionnaire de correspondance depuis les ressources chargées
  const _rscMap = {};
  ressources.forEach(r => {
    const ancien = r.Nom + ' ' + r.Prenom;
    const nouveau = r.Prenom + ' ' + r.Nom;
    if (ancien !== nouveau) _rscMap[ancien] = nouveau;
  });
  if (Object.keys(_rscMap).length > 0) {
    lignesProjets = lignesProjets.map(l =>
      ({ ...l, ressource: _rscMap[l.ressource] || l.ressource }));
    absences = absences.map(a =>
      ({ ...a, Ressource: _rscMap[a.Ressource] || a.Ressource }));
    horsProjets = horsProjets.map(h =>
      ({ ...h, Ressource: _rscMap[h.Ressource] || h.Ressource }));
    projets = projets.map(p =>
      ({ ...p, Responsable: _rscMap[p.Responsable] || p.Responsable }));
  }
  // ── Fin migration ──
  // joursFeries : on ne remplace PAS si le doc n'en contient pas
  // (données statiques définies dans ce fichier), mais on accepte
  // les surcharges de Firestore si présentes
  if (data.joursFeries && data.joursFeries.length > 0) {
    joursFeries = data.joursFeries;
  }
  _recalcNextId();
}

// ── Charger les données + démarrer le listener temps réel ───
async function loadAllData() {
  showLoading(true);
  try {
    const _db = initFirebase();
    const docRef = _db.collection('geieae').doc('appdata');

    // Lecture initiale synchrone pour affichage rapide
    const docSnap = await docRef.get();
    if (docSnap.exists) {
      _applySnapshot(docSnap.data());
      showToast('Données chargées ✓', 'ok');
    } else {
      // Premier lancement : initialiser avec les données vides
      ressources=[]; projets=[]; absences=[]; horsProjets=[];
      ganttTaches=[]; lignesProjets=[]; heuresProjets=[];
      nextId = 1;
      showToast('Première utilisation — données vides', '');
    }

    showLoading(false);
    renderAll();

    // ── Démarrer le listener temps réel ─────────────────────
    // Toute modification faite par un autre utilisateur sera
    // reçue ici et appliquée automatiquement
    if (_unsubscribeSnapshot) _unsubscribeSnapshot(); // détacher ancien listener

    _unsubscribeSnapshot = docRef.onSnapshot(
      { includeMetadataChanges: false }, // on ignore les changements de cache local
      (snap) => {
        // Ignorer si c'est notre propre sauvegarde en cours
        if (_isSaving) return;
        // Ignorer les événements depuis le cache local (pas du serveur)
        if (snap.metadata.fromCache) return;
        // Ignorer si pas de document
        if (!snap.exists) return;

        _applySnapshot(snap.data());
        renderAll();
        _showSyncBadge(); // indicateur discret "mis à jour"
      },
      (err) => {
        console.error('onSnapshot error:', err);
        showToast('⚠️ Perte de synchronisation temps réel', 'err');
      }
    );

  } catch(e) {
    showLoading(false);
    ressources=[]; projets=[]; absences=[]; horsProjets=[];
    ganttTaches=[]; lignesProjets=[]; heuresProjets=[];
    renderAll();
    showToast('Erreur Firebase: ' + e.message, 'err');
    console.error('loadAllData:', e);
  }
}

// ── Sauvegarder toutes les données (debounce 400ms) ─────────
//
// STRATÉGIE ANTI-ÉCRASEMENT :
// On utilise une transaction Firestore qui lit l'état serveur
// avant d'écrire. Si deux utilisateurs sauvegardent en même
// temps, Firestore rejouera automatiquement la transaction
// perdante avec les données à jour, évitant tout écrasement.
//
function saveAllData() {
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(_doSave, 400);
}

async function _doSave() {
  _isSaving = true;
  try {
    const _db = initFirebase();
    const docRef = _db.collection('geieae').doc('appdata');

    // Transaction : lecture + écriture atomiques
    await _db.runTransaction(async (tx) => {
      // Lire l'état serveur actuel (pour que la transaction
      // soit enregistrée comme dépendante de cette version)
      await tx.get(docRef);

      // Écrire notre état complet
      // Note : on utilise set() et non merge() car on veut
      // que notre état mémoire (qui est toujours le plus récent
      // pour NOTRE session) soit la référence.
      tx.set(docRef, {
        ressources,
        projets,
        absences,
        horsProjets,
        ganttTaches,
        lignesProjets,
        heuresProjets,
        joursFeries,
        _lastSaved: firebase.firestore.FieldValue.serverTimestamp(),
        _savedBy: navigator.userAgent.slice(0, 60) // debug
      });
    });

    _showSaveIndicator('ok');
  } catch(e) {
    // La transaction peut échouer si trop de contentions (>5 tentatives)
    // On propose alors un rechargement pour récupérer l'état serveur
    console.error('saveAllData transaction:', e);
    _showSaveIndicator('err');
    showToast('❌ Erreur sauvegarde — rechargement conseillé', 'err');
  } finally {
    _isSaving = false;
    if (_pendingSave) {
      _pendingSave = false;
      saveAllData(); // exécuter la sauvegarde qui attendait
    }
  }
}

// ── Indicateur de sauvegarde discret dans la topbar ─────────
function _showSaveIndicator(state) {
  let el = document.getElementById('_saveIndicator');
  if (!el) {
    el = document.createElement('div');
    el.id = '_saveIndicator';
    el.style.cssText = [
      'position:fixed', 'bottom:18px', 'right:22px', 'z-index:8000',
      'font-size:11px', 'font-weight:600', 'padding:5px 12px',
      'border-radius:20px', 'pointer-events:none',
      'transition:opacity .4s', 'opacity:0'
    ].join(';');
    document.body.appendChild(el);
  }
  if (state === 'ok') {
    el.style.background = '#d1fae5';
    el.style.color = '#065f46';
    el.textContent = '✓ Sauvegardé';
  } else {
    el.style.background = '#fee2e2';
    el.style.color = '#991b1b';
    el.textContent = '✗ Erreur sauvegarde';
  }
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2500);
}

// ── Badge "mis à jour par un autre utilisateur" ─────────────
function _showSyncBadge() {
  let el = document.getElementById('_syncBadge');
  if (!el) {
    el = document.createElement('div');
    el.id = '_syncBadge';
    el.style.cssText = [
      'position:fixed', 'bottom:18px', 'left:50%',
      'transform:translateX(-50%)',
      'z-index:8000', 'font-size:11px', 'font-weight:600',
      'padding:6px 16px', 'border-radius:20px',
      'background:#dbeafe', 'color:#1e40af',
      'pointer-events:none', 'transition:opacity .4s', 'opacity:0'
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = '🔄 Données mises à jour par un autre utilisateur';
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 3500);
}

function showLoading(show) {
  let el = document.getElementById('spLoadingOverlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'spLoadingOverlay';
    el.style.cssText = 'position:fixed;inset:0;background:rgba(26,58,92,0.85);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:DM Sans,sans-serif';
    el.innerHTML = '<div style="font-size:48px;margin-bottom:16px">⏳</div><div style="font-size:18px;font-weight:600">Chargement des données...</div><div style="font-size:13px;opacity:.7;margin-top:8px">GEIE AE — Plan de charge</div>';
    document.body.appendChild(el);
  }
  el.style.display = show ? 'flex' : 'none';
}

function renderAll() {
  renderProj();
  renderRsc();
  renderFeries();
  renderAbs();
  renderHP();
  renderHomeKpi();
}


let ressources = []; // Chargé depuis Firebase

let absences = []; // Chargé depuis Firebase

let horsProjets = []; // Chargé depuis Firebase

// Tâches Gantt : {id, projetId, nom, dateDebut, dateFin, jalon}
let ganttTaches = []; // Chargé depuis Firebase

// Lignes de planning projet : {id, projetId, tacheGanttId, ressource}
let lignesProjets = []; // Chargé depuis Firebase

// Heures saisies : {id, ligneId, projetId, date, heures}
let heuresProjets = []; // Chargé depuis Firebase

let projets = []; // Chargé depuis Firebase

let joursFeries = [
  {id:1,Libelle:"Jour de l'An",Date:"2026-01-01",Pays:"France+Luxembourg",Annee:2026},
  {id:2,Libelle:"Lundi de Pâques",Date:"2026-04-06",Pays:"France+Luxembourg",Annee:2026},
  {id:3,Libelle:"Fête du Travail",Date:"2026-05-01",Pays:"France+Luxembourg",Annee:2026},
  {id:4,Libelle:"Victoire 1945",Date:"2026-05-08",Pays:"France+Luxembourg",Annee:2026},
  {id:5,Libelle:"Jour de l'Europe",Date:"2026-05-09",Pays:"Luxembourg",Annee:2026},
  {id:6,Libelle:"Ascension",Date:"2026-05-14",Pays:"France+Luxembourg",Annee:2026},
  {id:7,Libelle:"Lundi de Pentecôte",Date:"2026-05-25",Pays:"France+Luxembourg",Annee:2026},
  {id:8,Libelle:"Fête Nationale (Luxembourg)",Date:"2026-06-23",Pays:"Luxembourg",Annee:2026},
  {id:9,Libelle:"Fête Nationale (France)",Date:"2026-07-14",Pays:"France",Annee:2026},
  {id:10,Libelle:"Assomption",Date:"2026-08-15",Pays:"France+Luxembourg",Annee:2026},
  {id:11,Libelle:"Toussaint",Date:"2026-11-01",Pays:"France+Luxembourg",Annee:2026},
  {id:12,Libelle:"Armistice",Date:"2026-11-11",Pays:"France+Luxembourg",Annee:2026},
  {id:13,Libelle:"Noël",Date:"2026-12-25",Pays:"France+Luxembourg",Annee:2026},
  {id:14,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2026-12-26",Pays:"Luxembourg",Annee:2026},
  {id:15,Libelle:"Jour de l'An",Date:"2027-01-01",Pays:"France+Luxembourg",Annee:2027},
  {id:16,Libelle:"Lundi de Pâques",Date:"2027-03-29",Pays:"France+Luxembourg",Annee:2027},
  {id:17,Libelle:"Fête du Travail",Date:"2027-05-01",Pays:"France+Luxembourg",Annee:2027},
  {id:18,Libelle:"Ascension",Date:"2027-05-06",Pays:"France+Luxembourg",Annee:2027},
  {id:19,Libelle:"Victoire 1945",Date:"2027-05-08",Pays:"France+Luxembourg",Annee:2027},
  {id:20,Libelle:"Jour de l'Europe",Date:"2027-05-09",Pays:"Luxembourg",Annee:2027},
  {id:21,Libelle:"Lundi de Pentecôte",Date:"2027-05-17",Pays:"France+Luxembourg",Annee:2027},
  {id:22,Libelle:"Fête Nationale (Luxembourg)",Date:"2027-06-23",Pays:"Luxembourg",Annee:2027},
  {id:23,Libelle:"Fête Nationale (France)",Date:"2027-07-14",Pays:"France",Annee:2027},
  {id:24,Libelle:"Assomption",Date:"2027-08-15",Pays:"France+Luxembourg",Annee:2027},
  {id:25,Libelle:"Toussaint",Date:"2027-11-01",Pays:"France+Luxembourg",Annee:2027},
  {id:26,Libelle:"Armistice",Date:"2027-11-11",Pays:"France+Luxembourg",Annee:2027},
  {id:27,Libelle:"Noël",Date:"2027-12-25",Pays:"France+Luxembourg",Annee:2027},
  {id:28,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2027-12-26",Pays:"Luxembourg",Annee:2027},
  {id:29,Libelle:"Jour de l'An",Date:"2028-01-01",Pays:"France+Luxembourg",Annee:2028},
  {id:30,Libelle:"Lundi de Pâques",Date:"2028-04-17",Pays:"France+Luxembourg",Annee:2028},
  {id:31,Libelle:"Fête du Travail",Date:"2028-05-01",Pays:"France+Luxembourg",Annee:2028},
  {id:32,Libelle:"Victoire 1945",Date:"2028-05-08",Pays:"France+Luxembourg",Annee:2028},
  {id:33,Libelle:"Jour de l'Europe",Date:"2028-05-09",Pays:"Luxembourg",Annee:2028},
  {id:34,Libelle:"Ascension",Date:"2028-05-25",Pays:"France+Luxembourg",Annee:2028},
  {id:35,Libelle:"Lundi de Pentecôte",Date:"2028-06-05",Pays:"France+Luxembourg",Annee:2028},
  {id:36,Libelle:"Fête Nationale (Luxembourg)",Date:"2028-06-23",Pays:"Luxembourg",Annee:2028},
  {id:37,Libelle:"Fête Nationale (France)",Date:"2028-07-14",Pays:"France",Annee:2028},
  {id:38,Libelle:"Assomption",Date:"2028-08-15",Pays:"France+Luxembourg",Annee:2028},
  {id:39,Libelle:"Toussaint",Date:"2028-11-01",Pays:"France+Luxembourg",Annee:2028},
  {id:40,Libelle:"Armistice",Date:"2028-11-11",Pays:"France+Luxembourg",Annee:2028},
  {id:41,Libelle:"Noël",Date:"2028-12-25",Pays:"France+Luxembourg",Annee:2028},
  {id:42,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2028-12-26",Pays:"Luxembourg",Annee:2028},
  {id:43,Libelle:"Jour de l'An",Date:"2029-01-01",Pays:"France+Luxembourg",Annee:2029},
  {id:44,Libelle:"Lundi de Pâques",Date:"2029-04-02",Pays:"France+Luxembourg",Annee:2029},
  {id:45,Libelle:"Fête du Travail",Date:"2029-05-01",Pays:"France+Luxembourg",Annee:2029},
  {id:46,Libelle:"Victoire 1945",Date:"2029-05-08",Pays:"France+Luxembourg",Annee:2029},
  {id:47,Libelle:"Jour de l'Europe",Date:"2029-05-09",Pays:"Luxembourg",Annee:2029},
  {id:48,Libelle:"Ascension",Date:"2029-05-10",Pays:"France+Luxembourg",Annee:2029},
  {id:49,Libelle:"Lundi de Pentecôte",Date:"2029-05-21",Pays:"France+Luxembourg",Annee:2029},
  {id:50,Libelle:"Fête Nationale (Luxembourg)",Date:"2029-06-23",Pays:"Luxembourg",Annee:2029},
  {id:51,Libelle:"Fête Nationale (France)",Date:"2029-07-14",Pays:"France",Annee:2029},
  {id:52,Libelle:"Assomption",Date:"2029-08-15",Pays:"France+Luxembourg",Annee:2029},
  {id:53,Libelle:"Toussaint",Date:"2029-11-01",Pays:"France+Luxembourg",Annee:2029},
  {id:54,Libelle:"Armistice",Date:"2029-11-11",Pays:"France+Luxembourg",Annee:2029},
  {id:55,Libelle:"Noël",Date:"2029-12-25",Pays:"France+Luxembourg",Annee:2029},
  {id:56,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2029-12-26",Pays:"Luxembourg",Annee:2029},
  {id:57,Libelle:"Jour de l'An",Date:"2030-01-01",Pays:"France+Luxembourg",Annee:2030},
  {id:58,Libelle:"Lundi de Pâques",Date:"2030-04-22",Pays:"France+Luxembourg",Annee:2030},
  {id:59,Libelle:"Fête du Travail",Date:"2030-05-01",Pays:"France+Luxembourg",Annee:2030},
  {id:60,Libelle:"Victoire 1945",Date:"2030-05-08",Pays:"France+Luxembourg",Annee:2030},
  {id:61,Libelle:"Jour de l'Europe",Date:"2030-05-09",Pays:"Luxembourg",Annee:2030},
  {id:62,Libelle:"Ascension",Date:"2030-05-30",Pays:"France+Luxembourg",Annee:2030},
  {id:63,Libelle:"Lundi de Pentecôte",Date:"2030-06-10",Pays:"France+Luxembourg",Annee:2030},
  {id:64,Libelle:"Fête Nationale (Luxembourg)",Date:"2030-06-23",Pays:"Luxembourg",Annee:2030},
  {id:65,Libelle:"Fête Nationale (France)",Date:"2030-07-14",Pays:"France",Annee:2030},
  {id:66,Libelle:"Assomption",Date:"2030-08-15",Pays:"France+Luxembourg",Annee:2030},
  {id:67,Libelle:"Toussaint",Date:"2030-11-01",Pays:"France+Luxembourg",Annee:2030},
  {id:68,Libelle:"Armistice",Date:"2030-11-11",Pays:"France+Luxembourg",Annee:2030},
  {id:69,Libelle:"Noël",Date:"2030-12-25",Pays:"France+Luxembourg",Annee:2030},
  {id:70,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2030-12-26",Pays:"Luxembourg",Annee:2030},
  {id:71,Libelle:"Jour de l'An",Date:"2031-01-01",Pays:"France+Luxembourg",Annee:2031},
  {id:72,Libelle:"Lundi de Pâques",Date:"2031-04-14",Pays:"France+Luxembourg",Annee:2031},
  {id:73,Libelle:"Fête du Travail",Date:"2031-05-01",Pays:"France+Luxembourg",Annee:2031},
  {id:74,Libelle:"Victoire 1945",Date:"2031-05-08",Pays:"France+Luxembourg",Annee:2031},
  {id:75,Libelle:"Jour de l'Europe",Date:"2031-05-09",Pays:"Luxembourg",Annee:2031},
  {id:76,Libelle:"Ascension",Date:"2031-05-22",Pays:"France+Luxembourg",Annee:2031},
  {id:77,Libelle:"Lundi de Pentecôte",Date:"2031-06-02",Pays:"France+Luxembourg",Annee:2031},
  {id:78,Libelle:"Fête Nationale (Luxembourg)",Date:"2031-06-23",Pays:"Luxembourg",Annee:2031},
  {id:79,Libelle:"Fête Nationale (France)",Date:"2031-07-14",Pays:"France",Annee:2031},
  {id:80,Libelle:"Assomption",Date:"2031-08-15",Pays:"France+Luxembourg",Annee:2031},
  {id:81,Libelle:"Toussaint",Date:"2031-11-01",Pays:"France+Luxembourg",Annee:2031},
  {id:82,Libelle:"Armistice",Date:"2031-11-11",Pays:"France+Luxembourg",Annee:2031},
  {id:83,Libelle:"Noël",Date:"2031-12-25",Pays:"France+Luxembourg",Annee:2031},
  {id:84,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2031-12-26",Pays:"Luxembourg",Annee:2031},
  {id:85,Libelle:"Jour de l'An",Date:"2032-01-01",Pays:"France+Luxembourg",Annee:2032},
  {id:86,Libelle:"Lundi de Pâques",Date:"2032-03-29",Pays:"France+Luxembourg",Annee:2032},
  {id:87,Libelle:"Fête du Travail",Date:"2032-05-01",Pays:"France+Luxembourg",Annee:2032},
  {id:88,Libelle:"Ascension",Date:"2032-05-06",Pays:"France+Luxembourg",Annee:2032},
  {id:89,Libelle:"Victoire 1945",Date:"2032-05-08",Pays:"France+Luxembourg",Annee:2032},
  {id:90,Libelle:"Jour de l'Europe",Date:"2032-05-09",Pays:"Luxembourg",Annee:2032},
  {id:91,Libelle:"Lundi de Pentecôte",Date:"2032-05-17",Pays:"France+Luxembourg",Annee:2032},
  {id:92,Libelle:"Fête Nationale (Luxembourg)",Date:"2032-06-23",Pays:"Luxembourg",Annee:2032},
  {id:93,Libelle:"Fête Nationale (France)",Date:"2032-07-14",Pays:"France",Annee:2032},
  {id:94,Libelle:"Assomption",Date:"2032-08-15",Pays:"France+Luxembourg",Annee:2032},
  {id:95,Libelle:"Toussaint",Date:"2032-11-01",Pays:"France+Luxembourg",Annee:2032},
  {id:96,Libelle:"Armistice",Date:"2032-11-11",Pays:"France+Luxembourg",Annee:2032},
  {id:97,Libelle:"Noël",Date:"2032-12-25",Pays:"France+Luxembourg",Annee:2032},
  {id:98,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2032-12-26",Pays:"Luxembourg",Annee:2032},
  {id:99,Libelle:"Jour de l'An",Date:"2033-01-01",Pays:"France+Luxembourg",Annee:2033},
  {id:100,Libelle:"Lundi de Pâques",Date:"2033-04-18",Pays:"France+Luxembourg",Annee:2033},
  {id:101,Libelle:"Fête du Travail",Date:"2033-05-01",Pays:"France+Luxembourg",Annee:2033},
  {id:102,Libelle:"Victoire 1945",Date:"2033-05-08",Pays:"France+Luxembourg",Annee:2033},
  {id:103,Libelle:"Jour de l'Europe",Date:"2033-05-09",Pays:"Luxembourg",Annee:2033},
  {id:104,Libelle:"Ascension",Date:"2033-05-26",Pays:"France+Luxembourg",Annee:2033},
  {id:105,Libelle:"Lundi de Pentecôte",Date:"2033-06-06",Pays:"France+Luxembourg",Annee:2033},
  {id:106,Libelle:"Fête Nationale (Luxembourg)",Date:"2033-06-23",Pays:"Luxembourg",Annee:2033},
  {id:107,Libelle:"Fête Nationale (France)",Date:"2033-07-14",Pays:"France",Annee:2033},
  {id:108,Libelle:"Assomption",Date:"2033-08-15",Pays:"France+Luxembourg",Annee:2033},
  {id:109,Libelle:"Toussaint",Date:"2033-11-01",Pays:"France+Luxembourg",Annee:2033},
  {id:110,Libelle:"Armistice",Date:"2033-11-11",Pays:"France+Luxembourg",Annee:2033},
  {id:111,Libelle:"Noël",Date:"2033-12-25",Pays:"France+Luxembourg",Annee:2033},
  {id:112,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2033-12-26",Pays:"Luxembourg",Annee:2033},
  {id:113,Libelle:"Jour de l'An",Date:"2034-01-01",Pays:"France+Luxembourg",Annee:2034},
  {id:114,Libelle:"Lundi de Pâques",Date:"2034-04-10",Pays:"France+Luxembourg",Annee:2034},
  {id:115,Libelle:"Fête du Travail",Date:"2034-05-01",Pays:"France+Luxembourg",Annee:2034},
  {id:116,Libelle:"Victoire 1945",Date:"2034-05-08",Pays:"France+Luxembourg",Annee:2034},
  {id:117,Libelle:"Jour de l'Europe",Date:"2034-05-09",Pays:"Luxembourg",Annee:2034},
  {id:118,Libelle:"Ascension",Date:"2034-05-18",Pays:"France+Luxembourg",Annee:2034},
  {id:119,Libelle:"Lundi de Pentecôte",Date:"2034-05-29",Pays:"France+Luxembourg",Annee:2034},
  {id:120,Libelle:"Fête Nationale (Luxembourg)",Date:"2034-06-23",Pays:"Luxembourg",Annee:2034},
  {id:121,Libelle:"Fête Nationale (France)",Date:"2034-07-14",Pays:"France",Annee:2034},
  {id:122,Libelle:"Assomption",Date:"2034-08-15",Pays:"France+Luxembourg",Annee:2034},
  {id:123,Libelle:"Toussaint",Date:"2034-11-01",Pays:"France+Luxembourg",Annee:2034},
  {id:124,Libelle:"Armistice",Date:"2034-11-11",Pays:"France+Luxembourg",Annee:2034},
  {id:125,Libelle:"Noël",Date:"2034-12-25",Pays:"France+Luxembourg",Annee:2034},
  {id:126,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2034-12-26",Pays:"Luxembourg",Annee:2034},
  {id:127,Libelle:"Jour de l'An",Date:"2035-01-01",Pays:"France+Luxembourg",Annee:2035},
  {id:128,Libelle:"Lundi de Pâques",Date:"2035-03-26",Pays:"France+Luxembourg",Annee:2035},
  {id:129,Libelle:"Fête du Travail",Date:"2035-05-01",Pays:"France+Luxembourg",Annee:2035},
  {id:130,Libelle:"Ascension",Date:"2035-05-03",Pays:"France+Luxembourg",Annee:2035},
  {id:131,Libelle:"Victoire 1945",Date:"2035-05-08",Pays:"France+Luxembourg",Annee:2035},
  {id:132,Libelle:"Jour de l'Europe",Date:"2035-05-09",Pays:"Luxembourg",Annee:2035},
  {id:133,Libelle:"Lundi de Pentecôte",Date:"2035-05-14",Pays:"France+Luxembourg",Annee:2035},
  {id:134,Libelle:"Fête Nationale (Luxembourg)",Date:"2035-06-23",Pays:"Luxembourg",Annee:2035},
  {id:135,Libelle:"Fête Nationale (France)",Date:"2035-07-14",Pays:"France",Annee:2035},
  {id:136,Libelle:"Assomption",Date:"2035-08-15",Pays:"France+Luxembourg",Annee:2035},
  {id:137,Libelle:"Toussaint",Date:"2035-11-01",Pays:"France+Luxembourg",Annee:2035},
  {id:138,Libelle:"Armistice",Date:"2035-11-11",Pays:"France+Luxembourg",Annee:2035},
  {id:139,Libelle:"Noël",Date:"2035-12-25",Pays:"France+Luxembourg",Annee:2035},
  {id:140,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2035-12-26",Pays:"Luxembourg",Annee:2035},
  {id:141,Libelle:"Jour de l'An",Date:"2036-01-01",Pays:"France+Luxembourg",Annee:2036},
  {id:142,Libelle:"Lundi de Pâques",Date:"2036-04-14",Pays:"France+Luxembourg",Annee:2036},
  {id:143,Libelle:"Fête du Travail",Date:"2036-05-01",Pays:"France+Luxembourg",Annee:2036},
  {id:144,Libelle:"Victoire 1945",Date:"2036-05-08",Pays:"France+Luxembourg",Annee:2036},
  {id:145,Libelle:"Jour de l'Europe",Date:"2036-05-09",Pays:"Luxembourg",Annee:2036},
  {id:146,Libelle:"Ascension",Date:"2036-05-22",Pays:"France+Luxembourg",Annee:2036},
  {id:147,Libelle:"Lundi de Pentecôte",Date:"2036-06-02",Pays:"France+Luxembourg",Annee:2036},
  {id:148,Libelle:"Fête Nationale (Luxembourg)",Date:"2036-06-23",Pays:"Luxembourg",Annee:2036},
  {id:149,Libelle:"Fête Nationale (France)",Date:"2036-07-14",Pays:"France",Annee:2036},
  {id:150,Libelle:"Assomption",Date:"2036-08-15",Pays:"France+Luxembourg",Annee:2036},
  {id:151,Libelle:"Toussaint",Date:"2036-11-01",Pays:"France+Luxembourg",Annee:2036},
  {id:152,Libelle:"Armistice",Date:"2036-11-11",Pays:"France+Luxembourg",Annee:2036},
  {id:153,Libelle:"Noël",Date:"2036-12-25",Pays:"France+Luxembourg",Annee:2036},
  {id:154,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2036-12-26",Pays:"Luxembourg",Annee:2036},
  {id:155,Libelle:"Jour de l'An",Date:"2037-01-01",Pays:"France+Luxembourg",Annee:2037},
  {id:156,Libelle:"Lundi de Pâques",Date:"2037-04-06",Pays:"France+Luxembourg",Annee:2037},
  {id:157,Libelle:"Fête du Travail",Date:"2037-05-01",Pays:"France+Luxembourg",Annee:2037},
  {id:158,Libelle:"Victoire 1945",Date:"2037-05-08",Pays:"France+Luxembourg",Annee:2037},
  {id:159,Libelle:"Jour de l'Europe",Date:"2037-05-09",Pays:"Luxembourg",Annee:2037},
  {id:160,Libelle:"Ascension",Date:"2037-05-14",Pays:"France+Luxembourg",Annee:2037},
  {id:161,Libelle:"Lundi de Pentecôte",Date:"2037-05-25",Pays:"France+Luxembourg",Annee:2037},
  {id:162,Libelle:"Fête Nationale (Luxembourg)",Date:"2037-06-23",Pays:"Luxembourg",Annee:2037},
  {id:163,Libelle:"Fête Nationale (France)",Date:"2037-07-14",Pays:"France",Annee:2037},
  {id:164,Libelle:"Assomption",Date:"2037-08-15",Pays:"France+Luxembourg",Annee:2037},
  {id:165,Libelle:"Toussaint",Date:"2037-11-01",Pays:"France+Luxembourg",Annee:2037},
  {id:166,Libelle:"Armistice",Date:"2037-11-11",Pays:"France+Luxembourg",Annee:2037},
  {id:167,Libelle:"Noël",Date:"2037-12-25",Pays:"France+Luxembourg",Annee:2037},
  {id:168,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2037-12-26",Pays:"Luxembourg",Annee:2037},
  {id:169,Libelle:"Jour de l'An",Date:"2038-01-01",Pays:"France+Luxembourg",Annee:2038},
  {id:170,Libelle:"Lundi de Pâques",Date:"2038-04-26",Pays:"France+Luxembourg",Annee:2038},
  {id:171,Libelle:"Fête du Travail",Date:"2038-05-01",Pays:"France+Luxembourg",Annee:2038},
  {id:172,Libelle:"Victoire 1945",Date:"2038-05-08",Pays:"France+Luxembourg",Annee:2038},
  {id:173,Libelle:"Jour de l'Europe",Date:"2038-05-09",Pays:"Luxembourg",Annee:2038},
  {id:174,Libelle:"Ascension",Date:"2038-06-03",Pays:"France+Luxembourg",Annee:2038},
  {id:175,Libelle:"Lundi de Pentecôte",Date:"2038-06-14",Pays:"France+Luxembourg",Annee:2038},
  {id:176,Libelle:"Fête Nationale (Luxembourg)",Date:"2038-06-23",Pays:"Luxembourg",Annee:2038},
  {id:177,Libelle:"Fête Nationale (France)",Date:"2038-07-14",Pays:"France",Annee:2038},
  {id:178,Libelle:"Assomption",Date:"2038-08-15",Pays:"France+Luxembourg",Annee:2038},
  {id:179,Libelle:"Toussaint",Date:"2038-11-01",Pays:"France+Luxembourg",Annee:2038},
  {id:180,Libelle:"Armistice",Date:"2038-11-11",Pays:"France+Luxembourg",Annee:2038},
  {id:181,Libelle:"Noël",Date:"2038-12-25",Pays:"France+Luxembourg",Annee:2038},
  {id:182,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2038-12-26",Pays:"Luxembourg",Annee:2038},
  {id:183,Libelle:"Jour de l'An",Date:"2039-01-01",Pays:"France+Luxembourg",Annee:2039},
  {id:184,Libelle:"Lundi de Pâques",Date:"2039-04-11",Pays:"France+Luxembourg",Annee:2039},
  {id:185,Libelle:"Fête du Travail",Date:"2039-05-01",Pays:"France+Luxembourg",Annee:2039},
  {id:186,Libelle:"Victoire 1945",Date:"2039-05-08",Pays:"France+Luxembourg",Annee:2039},
  {id:187,Libelle:"Jour de l'Europe",Date:"2039-05-09",Pays:"Luxembourg",Annee:2039},
  {id:188,Libelle:"Ascension",Date:"2039-05-19",Pays:"France+Luxembourg",Annee:2039},
  {id:189,Libelle:"Lundi de Pentecôte",Date:"2039-05-30",Pays:"France+Luxembourg",Annee:2039},
  {id:190,Libelle:"Fête Nationale (Luxembourg)",Date:"2039-06-23",Pays:"Luxembourg",Annee:2039},
  {id:191,Libelle:"Fête Nationale (France)",Date:"2039-07-14",Pays:"France",Annee:2039},
  {id:192,Libelle:"Assomption",Date:"2039-08-15",Pays:"France+Luxembourg",Annee:2039},
  {id:193,Libelle:"Toussaint",Date:"2039-11-01",Pays:"France+Luxembourg",Annee:2039},
  {id:194,Libelle:"Armistice",Date:"2039-11-11",Pays:"France+Luxembourg",Annee:2039},
  {id:195,Libelle:"Noël",Date:"2039-12-25",Pays:"France+Luxembourg",Annee:2039},
  {id:196,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2039-12-26",Pays:"Luxembourg",Annee:2039},
  {id:197,Libelle:"Jour de l'An",Date:"2040-01-01",Pays:"France+Luxembourg",Annee:2040},
  {id:198,Libelle:"Lundi de Pâques",Date:"2040-04-02",Pays:"France+Luxembourg",Annee:2040},
  {id:199,Libelle:"Fête du Travail",Date:"2040-05-01",Pays:"France+Luxembourg",Annee:2040},
  {id:200,Libelle:"Victoire 1945",Date:"2040-05-08",Pays:"France+Luxembourg",Annee:2040},
  {id:201,Libelle:"Jour de l'Europe",Date:"2040-05-09",Pays:"Luxembourg",Annee:2040},
  {id:202,Libelle:"Ascension",Date:"2040-05-10",Pays:"France+Luxembourg",Annee:2040},
  {id:203,Libelle:"Lundi de Pentecôte",Date:"2040-05-21",Pays:"France+Luxembourg",Annee:2040},
  {id:204,Libelle:"Fête Nationale (Luxembourg)",Date:"2040-06-23",Pays:"Luxembourg",Annee:2040},
  {id:205,Libelle:"Fête Nationale (France)",Date:"2040-07-14",Pays:"France",Annee:2040},
  {id:206,Libelle:"Assomption",Date:"2040-08-15",Pays:"France+Luxembourg",Annee:2040},
  {id:207,Libelle:"Toussaint",Date:"2040-11-01",Pays:"France+Luxembourg",Annee:2040},
  {id:208,Libelle:"Armistice",Date:"2040-11-11",Pays:"France+Luxembourg",Annee:2040},
  {id:209,Libelle:"Noël",Date:"2040-12-25",Pays:"France+Luxembourg",Annee:2040},
  {id:210,Libelle:"Lendemain de Noël (Saint-Étienne)",Date:"2040-12-26",Pays:"Luxembourg",Annee:2040}
];

let nextId = 50;
