# 🖥️ Portfolio — Bureau Mac OS X (Leopard)

Un portfolio interactif présenté comme un **vrai bureau Mac OS X** : fond d'écran aurora façon Leopard, barre de menus translucide, dock avec magnification, fenêtres à « traffic lights », écran de démarrage animé… et même un terminal fonctionnel.

## ✨ Fonctionnalités

- **Écran de démarrage** façon Mac (logo Apple grisé + barre de progression)
- **Barre de menus** translucide : logo, menus, icônes Wi-Fi / batterie / volume, horloge en direct
- **Bureau** avec icônes et fond d'écran aurora
- **Dock** en verre dépoli avec **magnification** au survol (les icônes s'écartent, comme sur un vrai Mac), info-bulles, indicateurs d'apps ouvertes, corbeille
- **Fenêtres aqua** : traffic lights (fermer / réduire / plein écran), déplacement, redimensionnement, réduction vers le dock
- **Terminal interactif** : `help`, `whoami`, `ls`, `date`, `open profil`, `sudo` 😄…
- **Navigateur** intégré (barre d'outils façon Safari)
- **Dossiers** : Projets (avec les 3 projets), Finder (dossier d'accueil)
- Drag & drop des icônes, respect de `prefers-reduced-motion`

## 🚀 Lancer le projet

Le site charge des pages via iframes, il faut donc un petit serveur HTTP :

```bash
cd portfolio-osx
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

Ou avec n'importe quel serveur statique (VS Code Live Server, `npx serve`, etc.).

## 🗂️ Structure

```
├── index.html          # Bureau : boot, menu bar, desktop, dock
├── style.css           # Thème Mac OS X complet
├── index.js            # Logique du bureau (fenêtres, dock, terminal)
├── css/                # Styles des pages internes
├── pages/              # Profil, Contact, pages projets
├── assets/             # Fond d'écran, logo, icônes du dock (SVG)
└── projects/           # Les 3 projets démo
```

## 🎮 Projets inclus

| Projet | Description | Tech |
| ------ | ----------- | ---- |
| **Solva Mystery** | Jeu d'enquête 3D propulsé par l'IA, jouable dans le navigateur | Unity, GPT-4o, WebGL |
| **Harmonies** | Jeu de société en C++, jouable en terminal simulé | C++, Qt, WebAssembly |
| **Recrutement** | API backend Node.js/Express + base de données | Node.js, Express, PostgreSQL, MongoDB |

## 👤 À propos

**Yassir Bizguirne** — Élève ingénieur en Génie Informatique (UTC, Compiègne), disponible pour un stage ingénieur.

- 📧 yassirbizguirne05@gmail.com
- 💼 [LinkedIn](https://www.linkedin.com/in/yassir-bizguirne-a467a71a7)
- 🐙 [GitHub](https://github.com/batyass)

---

*Site personnel — thème visuel inspiré de macOS pour un usage portfolio. Aucune affiliation avec Apple.*
