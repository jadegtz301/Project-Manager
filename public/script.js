// Sélection des éléments
const projectForm = document.getElementById('project-form');
const projectsList = document.getElementById('projects-list');
const themeToggle = document.getElementById('theme-toggle');

// Thème: respecter la préférence utilisateur si elle est stockée, sinon utiliser la préférence du navigateur
function applyThemeFromPreference(){
  const stored = localStorage.getItem('theme');
  if(stored === 'dark'){
    document.body.classList.add('dark');
  } else if(stored === 'light'){
    document.body.classList.remove('dark');
  } else {
    // pas de préférence stockée => utiliser prefers-color-scheme
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if(prefersDark) document.body.classList.add('dark');
    else document.body.classList.remove('dark');
  }
  updateThemeButton();
}

applyThemeFromPreference();

let currentUser = null;
async function fetchMe(){
  try{
    const res = await fetch('/me');
    if(!res.ok) return; // not logged in
    const j = await res.json();
    currentUser = j;
    renderAuth();
  }catch(err){ console.log('not logged in') }
}

function renderAuth(){
  const area = document.getElementById('auth-area');
  if(!area) return;
  area.innerHTML = '';
  if(currentUser){
    const span = document.createElement('span');
    span.textContent = currentUser.username;
    const profileLink = document.createElement('a'); profileLink.href = '/profile.html'; profileLink.textContent = 'Profil'; profileLink.style.marginLeft='8px';
    const btn = document.createElement('button');
    btn.textContent = 'Déconnexion';
    btn.addEventListener('click', async ()=>{
      await fetch('/logout', { method: 'POST' });
      currentUser = null; renderAuth();
    });
    area.appendChild(span);
    area.appendChild(profileLink);
    area.appendChild(btn);
  } else {
    const a1 = document.createElement('a'); a1.href = '/login.html'; a1.textContent='Connexion';
    const a2 = document.createElement('a'); a2.href = '/signup.html'; a2.textContent='Inscription';
    area.appendChild(a1); area.appendChild(a2);
  }
}

// Try to fetch current user
fetchMe();

themeToggle?.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
  localStorage.setItem('theme', theme);
  updateThemeButton();
  // save preference server-side if authenticated
  if(currentUser){
    fetch('/me/prefs', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ prefs: { theme } }) }).catch(()=>{});
  }
});

// Si l'utilisateur change la préférence système et qu'il n'a pas défini de préférence explicite, on met à jour
if (window.matchMedia) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)');
  mq.addEventListener?.('change', (e) => {
    if (!localStorage.getItem('theme')) {
      if (e.matches) document.body.classList.add('dark');
      else document.body.classList.remove('dark');
      updateThemeButton();
    }
  });
}

function updateThemeButton(){
  if (!themeToggle) return;
  themeToggle.textContent = document.body.classList.contains('dark') ? 'Mode clair' : 'Mode sombre';
}

// Fonction pour afficher les projets
async function loadProjects() {
  try {
    const res = await fetch('/projects');
    if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
    const projects = await res.json();

    // Vider la liste avant de la remplir
    projectsList.innerHTML = '';

    projects.forEach(project => {
      const div = document.createElement('div');
      div.className = 'project';
      const statusClass = (project.status || '').toLowerCase().replace(/[^a-z0-9]+/g,'-');
      div.innerHTML = `
        <div class="meta">
          <div>
            <div class="title">${project.title}</div>
            <div class="desc">${project.description}</div>
          </div>
          <div class="badges">
            <div class="badge status-${statusClass}">${project.status}</div>
          </div>
        </div>
        <div class="actions">
          <select class="change-status" data-id="${project.id}">
            <option value="à prévoir">À prévoir</option>
            <option value="en cours">En cours</option>
            <option value="terminé">Terminé</option>
          </select>
          <button class="delete" data-id="${project.id}">Supprimer</button>
        </div>
      `;
      projectsList.appendChild(div);
      // set select to current status
      const sel = div.querySelector('.change-status');
      if(sel) sel.value = project.status || 'à prévoir';
    });

    // Ajouter les listeners pour supprimer
    // delete buttons
    document.querySelectorAll('.actions .delete').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        try {
          const delRes = await fetch(`/projects/${id}`, { method: 'DELETE' });
          if (!delRes.ok) throw new Error(`HTTP ${delRes.status} - ${delRes.statusText}`);
          loadProjects();
        } catch (err) {
          console.error('Erreur suppression projet:', err);
          projectsList.innerHTML = `<div class="error">Erreur suppression projet: ${err.message}</div>`;
        }
      });
    });

    // change status selects
    document.querySelectorAll('.change-status').forEach(sel => {
      sel.addEventListener('change', async () => {
        const id = sel.dataset.id;
        const newStatus = sel.value;
        try {
          const res = await fetch(`/projects/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          loadProjects();
        } catch (err) {
          console.error('Erreur mise à jour statut:', err);
        }
      });
    });

  } catch (err) {
    console.error('Erreur chargement projets:', err);
  }
}

// Ajouter un projet via le formulaire
projectForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const title = document.getElementById('title').value;
  const description = document.getElementById('description').value;
  const status = document.getElementById('status').value;

  try {
    await fetch('/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, description, status })
    });

    projectForm.reset();
    loadProjects();
  } catch (err) {
    console.error('Erreur ajout projet:', err);
    projectsList.innerHTML = `<div class="error">Erreur ajout projet: ${err.message}</div>`;
  }
});

// Charger les projets au démarrage
loadProjects();
