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
// users storage
const usersPath = path.join(__dirname, 'data', 'users.txt');
const crypto = require('crypto');

function readUsers(){
  try{
    const raw = fs.readFileSync(usersPath, 'utf8');
    const users = JSON.parse(raw);
    if(!Array.isArray(users)) return [];
    return users;
  }catch(err){
    return [];
  }
}

function writeUsers(users){
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2), 'utf8');
}

function hashPassword(password, salt){
  salt = salt || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function parseCookies(req){
  const header = req.headers.cookie || '';
  return header.split(';').map(s=>s.trim()).filter(Boolean).reduce((acc,c)=>{const [k,v]=c.split('='); acc[k]=v; return acc},{})
}

function getUserFromReq(req){
  const cookies = parseCookies(req);
  const token = cookies.authToken;
  if(!token) return null;
  const users = readUsers();
  return users.find(u=>u.token === token) || null;
}

// ===============================
// 🟢 ROUTE TEST
// ===============================
app.get("/", (req, res) => {
  // Servir la page index.html du dossier public
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ===============================
// � AUTH: signup / login / logout / me
// ===============================
app.post('/signup', (req,res)=>{
  try{
    const { username, password } = req.body;
    if(!username || !password) return res.status(400).json({ error: 'username & password required' });
    const users = readUsers();
    if(users.find(u=>u.username === username)) return res.status(409).json({ error: 'user exists' });
    const { salt, hash } = hashPassword(password);
    const token = crypto.randomBytes(24).toString('hex');
    const user = { id: Date.now(), username, salt, hash, token, prefs: {} };
    users.push(user);
    writeUsers(users);
    // set cookie
    res.setHeader('Set-Cookie', `authToken=${token}; HttpOnly; Path=/`);
    res.json({ message: 'ok', user: { id: user.id, username: user.username } });
  }catch(err){ console.error(err); res.status(500).json({ error: 'server error' }) }
});

app.post('/login', (req,res)=>{
  try{
    const { username, password } = req.body;
    if(!username || !password) return res.status(400).json({ error: 'username & password required' });
    const users = readUsers();
    const user = users.find(u=>u.username === username);
    if(!user) return res.status(401).json({ error: 'invalid' });
    const derived = crypto.scryptSync(password, user.salt, 64).toString('hex');
    if(derived !== user.hash) return res.status(401).json({ error: 'invalid' });
    // generate new token
    user.token = crypto.randomBytes(24).toString('hex');
    writeUsers(users);
    res.setHeader('Set-Cookie', `authToken=${user.token}; HttpOnly; Path=/`);
    res.json({ message: 'ok', user: { id: user.id, username: user.username } });
  }catch(err){ console.error(err); res.status(500).json({ error: 'server error' }) }
});

app.post('/logout', (req,res)=>{
  try{
    const users = readUsers();
    const cookies = parseCookies(req);
    const token = cookies.authToken;
    if(token){
      const u = users.find(x=>x.token===token);
      if(u){ delete u.token; writeUsers(users); }
    }
    // clear cookie
    res.setHeader('Set-Cookie', `authToken=; HttpOnly; Path=/; Max-Age=0`);
    res.json({ message: 'logged out' });
  }catch(err){ console.error(err); res.status(500).json({ error: 'server error' }) }
});

app.get('/me', (req,res)=>{
  try{
    const u = getUserFromReq(req);
    if(!u) return res.status(401).json({ error: 'not authenticated' });
    res.json({ id: u.id, username: u.username, prefs: u.prefs || {} });
  }catch(err){ console.error(err); res.status(500).json({ error: 'server error' }) }
});

// sauvegarder un paramètre utilisateur (ex: theme)
app.post('/me/prefs', (req,res)=>{
  try{
    const u = getUserFromReq(req);
    if(!u) return res.status(401).json({ error: 'not authenticated' });
    const { prefs } = req.body;
    if(typeof prefs !== 'object') return res.status(400).json({ error: 'prefs object required' });
    const users = readUsers();
    const user = users.find(x=>x.id===u.id);
    if(!user) return res.status(404).json({ error: 'not found' });
    user.prefs = Object.assign(user.prefs || {}, prefs);
    writeUsers(users);
    res.json({ message:'saved', prefs: user.prefs });
  }catch(err){ console.error(err); res.status(500).json({ error: 'server error' }) }
});

// ===============================
// � CHANGER LE MOT DE PASSE
// ===============================
app.post('/me/change-password', (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword & newPassword required' });

    const u = getUserFromReq(req);
    if (!u) return res.status(401).json({ error: 'not authenticated' });

    const users = readUsers();
    const user = users.find(x => x.id === u.id);
    if (!user) return res.status(404).json({ error: 'not found' });

    const derived = crypto.scryptSync(currentPassword, user.salt, 64).toString('hex');
    if (derived !== user.hash) return res.status(401).json({ error: 'invalid current password' });

    const { salt, hash } = hashPassword(newPassword);
    user.salt = salt;
    user.hash = hash;
    writeUsers(users);
    res.json({ message: 'password changed' });
  } catch (err) {
    console.error('Erreur change-password :', err);
    res.status(500).json({ error: 'server error' });
  }
});

// ===============================
// ��📋 LIRE TOUS LES PROJETS
// ===============================
app.get("/projects", (req, res) => {
  try {
    const data = fs.readFileSync(dataPath, "utf8");
    let projects = [];
    try { projects = JSON.parse(data); } catch { projects = []; }
    // retourner uniquement les projets de l'utilisateur connecté
    const u = getUserFromReq(req);
    if (!u) return res.json([]);
    const mine = projects.filter(p => p.ownerId === u.id);
    res.json(mine);
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

    // must be authenticated to create a project
    const u = getUserFromReq(req);
    if (!u) return res.status(401).json({ error: 'not authenticated' });

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
      ownerId: u.id,
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

    // vérifier propriétaire
    const u = getUserFromReq(req);
    if (!u) return res.status(401).json({ error: 'not authenticated' });

    // Recherche du projet
    const projectIndex = projects.findIndex((p) => p.id === id);
    if (projectIndex === -1) {
      return res.status(404).json({ error: "Projet introuvable." });
    }

    if (projects[projectIndex].ownerId !== u.id) {
      return res.status(403).json({ error: 'forbidden' });
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
// � METTRE À JOUR LE STATUT D'UN PROJET
// ===============================
app.patch('/projects/:id/status', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status } = req.body;

    if (isNaN(id)) return res.status(400).json({ error: 'ID invalide.' });
    if (!status) return res.status(400).json({ error: 'Status requis.' });

    let projects;
    try {
      projects = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      if (!Array.isArray(projects)) throw new Error('Données invalides');
    } catch {
      return res.status(500).json({ error: 'Impossible de lire les projets.' });
    }

  const project = projects.find(p => p.id === id);
  if (!project) return res.status(404).json({ error: 'Projet introuvable.' });

  const u = getUserFromReq(req);
  if (!u) return res.status(401).json({ error: 'not authenticated' });
  if (project.ownerId !== u.id) return res.status(403).json({ error: 'forbidden' });

  project.status = status;
    fs.writeFileSync(dataPath, JSON.stringify(projects, null, 2), 'utf8');

    res.json({ message: 'Statut mis à jour', project });
  } catch (err) {
    console.error('Erreur PATCH statut :', err);
    res.status(500).json({ error: 'Impossible de mettre à jour le statut.' });
  }
});

// ===============================
// �🚀 SERVIR LE FRONTEND (public)
// ===============================
app.use(express.static(path.join(__dirname, 'public')));

// ===============================
// 🚀 LANCEMENT DU SERVEUR
// ===============================
app.listen(PORT, () => {
  console.log(`Serveur lancé sur http://localhost:${PORT}`);
});
