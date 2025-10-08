// ===============================
// 🗂️ Project Manager Backend
// ===============================

const express = require("express");
const fs = require("fs");
const path = require("path");
const app = express();
const PORT = 3000;

// Middleware pour parser le JSON
app.use(express.json());

// Simple CORS middleware pour autoriser le frontend (utile si le frontend est ouvert
// depuis un autre origin ou si vous chargez `index.html` en file://)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  next();
});

// Répondre aux pré-requêtes CORS (générique pour éviter les erreurs path-to-regexp)
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Chemin vers le fichier de données
const dataPath = path.join(__dirname, "data", "data.txt");

// ===============================
// 🟢 ROUTE TEST
// ===============================
app.get("/", (req, res) => {
  // Servir la page index.html du dossier public
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===============================
// 📋 LIRE TOUS LES PROJETS
// ===============================
app.get("/projects", (req, res) => {
  try {
    const data = fs.readFileSync(dataPath, "utf8");
    const projects = JSON.parse(data);
    res.json(projects);
  } catch (error) {
    console.error("Erreur de lecture :", error);
    res.status(500).json({ error: "Impossible de lire les projets." });
  }
});

// ===============================
// 📝 AJOUTER UN PROJET
// ===============================
app.post("/projects", (req, res) => {
  try {
    const { title, description, status } = req.body;

    // Vérification basique
    if (!title || !description) {
      return res
        .status(400)
        .json({ error: "Le titre et la description sont requis." });
    }

    // Lecture du fichier
    let projects;
    try {
      projects = JSON.parse(fs.readFileSync(dataPath, "utf8"));
      if (!Array.isArray(projects)) throw new Error("Données invalides");
    } catch {
      projects = [];
    }

    // Génération d'un nouvel ID
    const newId =
      projects.length > 0 ? projects[projects.length - 1].id + 1 : 1;

    // Création du projet
    const newProject = {
      id: newId,
      title,
      description,
      status: status || "en cours",
      createdAt: new Date().toISOString(),
    };

    // Ajout et écriture
    projects.push(newProject);
    fs.writeFileSync(dataPath, JSON.stringify(projects, null, 2), "utf8");

    res
      .status(201)
      .json({ message: "Projet ajouté avec succès ✅", project: newProject });
  } catch (error) {
    console.error("Erreur POST :", error);
    res.status(500).json({ error: "Impossible d’ajouter le projet." });
  }
});

// ===============================
// ❌ SUPPRIMER UN PROJET
// ===============================
app.delete("/projects/:id", (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "ID invalide." });
    }

    // Lecture du fichier
    let projects;
    try {
      projects = JSON.parse(fs.readFileSync(dataPath, "utf8"));
      if (!Array.isArray(projects)) throw new Error("Données invalides");
    } catch {
      return res.status(500).json({ error: "Impossible de lire les projets." });
    }

    // Recherche du projet
    const projectIndex = projects.findIndex((p) => p.id === id);
    if (projectIndex === -1) {
      return res.status(404).json({ error: "Projet introuvable." });
    }

    // Suppression
    const deletedProject = projects.splice(projectIndex, 1)[0];
    fs.writeFileSync(dataPath, JSON.stringify(projects, null, 2), "utf8");

    res.json({
      message: "Projet supprimé avec succès ❌",
      deleted: deletedProject,
    });
  } catch (error) {
    console.error("Erreur DELETE :", error);
    res.status(500).json({ error: "Impossible de supprimer le projet." });
  }
});

// ===============================
// 🚀 SERVIR LE FRONTEND (public)
// ===============================
app.use(express.static(path.join(__dirname, 'public')));

// ===============================
// 🚀 LANCEMENT DU SERVEUR
// ===============================
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
