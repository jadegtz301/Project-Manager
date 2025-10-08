// Sélection des éléments
const projectForm = document.getElementById('project-form');
const projectsList = document.getElementById('projects-list');

// Fonction pour afficher les projets
async function loadProjects() {
  try {
    const res = await fetch('/projects');
    const projects = await res.json();

    // Vider la liste avant de la remplir
    projectsList.innerHTML = '';

    projects.forEach(project => {
      const div = document.createElement('div');
      div.className = 'project';
      div.innerHTML = `
        <div>
          <strong>${project.title}</strong> - ${project.description} (${project.status})
        </div>
        <button class="delete-btn" data-id="${project.id}">Supprimer</button>
      `;
      projectsList.appendChild(div);
    });

    // Ajouter les listeners pour supprimer
    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        await fetch(`/projects/${id}`, { method: 'DELETE' });
        loadProjects();
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
  }
});

// Charger les projets au démarrage
loadProjects();
