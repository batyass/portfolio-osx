/* ============================================================
   Portfolio — Bureau Mac OS X (Leopard)
   ============================================================ */

// ---------- Écran de démarrage ----------
window.addEventListener("load", () => {
    updateProgressBar(100);
    const loaderWrapper = document.getElementById("loader-wrapper");

    setTimeout(() => {
        loaderWrapper.classList.add("loader-hidden");
        loaderWrapper.addEventListener("transitionend", () => loaderWrapper.remove());
        setTimeout(() => loaderWrapper.remove(), 4500);
    }, 2400);
});

function updateProgressBar(percent) {
    const fill = document.getElementById("fill");
    if (fill) {
        fill.style.width = `${percent}%`;
    }
}

const resources = document.querySelectorAll("img, script");
let loadedCount = 0;
resources.forEach((resource) => {
    resource.addEventListener("load", () => {
        loadedCount += 1;
        updateProgressBar((loadedCount / resources.length) * 100);
    });
});

// ---------- Constantes ----------
let highestZIndex = 100;
const openWindows = new Map();
const openCounter = { n: 0 };

const ICONS = {
    finder: "./assets/icons/finder.svg",
    safari: "./assets/icons/safari.svg",
    mail: "./assets/icons/mail.svg",
    folder: "./assets/icons/folder.svg",
    terminal: "./assets/icons/terminal.svg",
    linkedin: "./assets/icons/linkedin.svg",
    github: "./assets/icons/github.svg",
    cv: "./assets/icons/cv.svg",
    profil: "./assets/icons/profil.svg",
    trash: "./assets/icons/trash.svg",
    magnifier: "./assets/icons/magnifier.svg",
    dice: "./assets/icons/dice.svg",
    clipboard: "./assets/icons/clipboard.svg"
};

const LINKEDIN_URL = "https://www.linkedin.com/in/yassir-bizguirne-a467a71a7";
const GITHUB_URL = "https://github.com/batyass";

function openExternal(url) {
    const link = document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    link.remove();
}

function nextWindowPosition() {
    openCounter.n += 1;
    const off = ((openCounter.n - 1) % 6) * 30;
    const top = 64 + off;
    const left = 100 + off;
    // Clamp au viewport selon la taille réelle de la fenêtre (mobile ≠ desktop)
    const defW = window.innerWidth < 680 ? window.innerWidth - 14 : 680;
    const defH = window.innerWidth < 680 ? Math.round(window.innerHeight * 0.55) : 460;
    const maxLeft = Math.max(8, window.innerWidth - defW - 8);
    const maxTop = Math.max(8, window.innerHeight - defH - 40);
    return { top: Math.min(top, maxTop), left: Math.min(left, maxLeft) };
}

// ---------- Ouverture / focus des fenêtres ----------
function openAppWindow(title, url, opts = {}) {
    const existing = openWindows.get(title);
    if (existing) {
        // Si la fenêtre a été retirée du DOM sans passer par closeWindow()
        // (état orphelin), on nettoie puis on la recrée proprement.
        if (!existing.windowElement || !existing.windowElement.isConnected) {
            openWindows.delete(title);
            existing.removeMiniTile();
            existing.markDockRunning(false);
        } else if (existing.isMinimized) {
            existing.restoreWindow();
            return;
        } else {
            existing.focusWindow();
            return;
        }
    }
    new WindowApp(title, url, opts);
}

// ---------- Drag & drop des icônes (état partagé) ----------
const dragState = { icon: null, dimTimer: null };

function restoreIconOpacity(icon) {
    clearTimeout(dragState.dimTimer);
    dragState.dimTimer = null;
    if (icon) {
        icon.style.opacity = "1";
    }
}

function attachIconDrag(icon) {
    icon.addEventListener("dragstart", (event) => {
        dragState.icon = icon;
        event.dataTransfer.setData("text/plain", "icon");
        event.dataTransfer.effectAllowed = "move";
        dragState.dimTimer = setTimeout(() => {
            icon.style.opacity = "0.4";
        }, 0);
    });

    icon.addEventListener("dragend", () => {
        restoreIconOpacity(dragState.icon);
        dragState.icon = null;
    });
}

// Drag tactile des icônes du bureau (HTML5 DnD ne fonctionne pas au toucher)
function attachTouchDrag(icon) {
    let startX = 0;
    let startY = 0;
    let dragging = false;

    const clearDropHighlights = () => {
        document.querySelectorAll(".grid-cell.drag-over").forEach((c) => c.classList.remove("drag-over"));
    };

    const highlightCellAt = (x, y) => {
        clearDropHighlights();
        const el = document.elementFromPoint(x, y);
        const cell = el && el.closest(".grid-cell");
        if (cell && !cell.querySelector(".desktop-icon")) {
            cell.classList.add("drag-over");
        }
    };

    icon.addEventListener("pointerdown", (event) => {
        if (event.pointerType !== "touch") {
            return;
        }
        startX = event.clientX;
        startY = event.clientY;
        dragging = false;
        icon._suppressClick = false;
        try {
            icon.setPointerCapture(event.pointerId);
        } catch { /* ignore */ }
    });

    icon.addEventListener("pointermove", (event) => {
        if (event.pointerType !== "touch") {
            return;
        }
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        if (!dragging && Math.hypot(dx, dy) > 12) {
            dragging = true;
            icon.classList.add("icon-dragging");
        }
        if (dragging) {
            icon.style.transform = `translate(${dx}px, ${dy}px)`;
            highlightCellAt(event.clientX, event.clientY);
        }
    });

    icon.addEventListener("pointerup", (event) => {
        if (event.pointerType !== "touch") {
            return;
        }
        if (dragging) {
            icon._suppressClick = true;
            setTimeout(() => {
                icon._suppressClick = false;
            }, 60);
            icon.classList.remove("icon-dragging");
            icon.style.transform = "";
            const el = document.elementFromPoint(event.clientX, event.clientY);
            const cell = el && el.closest(".grid-cell");
            if (cell && cell !== icon.parentElement && !cell.querySelector(".desktop-icon")) {
                cell.appendChild(icon);
            }
            clearDropHighlights();
        }
        dragging = false;
    });

    icon.addEventListener("pointercancel", () => {
        if (dragging) {
            icon.classList.remove("icon-dragging");
            icon.style.transform = "";
            clearDropHighlights();
        }
        dragging = false;
    });
}

function createDesktopIcon(source, name, url, onOpen, opts = {}) {
    const icon = document.createElement("div");
    icon.className = "desktop-icon";

    const isTouch = window.matchMedia("(pointer: coarse)").matches;
    icon.draggable = !isTouch; /* sur tactile : drag par pointer events (pas de DnD natif) */

    icon.innerHTML = `
        <div class="icon-img"><img src="${source}" alt="${name}"></div>
        <span class="icon-label">${name}</span>
    `;

    const openAction = () => {
        if (onOpen) {
            onOpen();
            return;
        }
        openAppWindow(name, url, { icon: source });
    };

    icon.addEventListener("dblclick", openAction);

    // Sur tactile : un simple tap ouvre l'app (pas de double-clic)
    if (isTouch) {
        icon.addEventListener("click", () => {
            if (icon._suppressClick) {
                return;
            }
            openAction();
        });
        if (opts.drag) {
            attachTouchDrag(icon);
        }
    }

    icon.addEventListener("mousedown", (event) => {
        event.stopPropagation();
        document.querySelectorAll(".desktop-icon.selected").forEach((el) => el.classList.remove("selected"));
        icon.classList.add("selected");
    });

    if (!isTouch) {
        attachIconDrag(icon);
    }
    return icon;
}

const projectItems = [
    { name: "Solva Mystery", icon: ICONS.magnifier, url: "./projects/solva-mystery/index.html" },
    { name: "Harmonies", icon: ICONS.dice, url: "./projects/harmonies/index.html" },
    { name: "Recrutement", icon: ICONS.clipboard, url: "./projects/backend-recrutement/index.html" }
];

const finderItems = [
    { name: "Projets", icon: ICONS.folder, onOpen: () => openAppWindow("Projets", null, { folder: projectItems, icon: ICONS.folder }) },
    { name: "Navigateur", icon: ICONS.safari, url: "./pages/navigateur.html" },
    { name: "Profil", icon: ICONS.profil, url: "./pages/profil.html" },
    { name: "Contact", icon: ICONS.mail, url: "./pages/contact.html" },
    { name: "CV", icon: ICONS.cv, url: "./assets/documents/cv_yassir_bizguirne.pdf" }
];

// ---------- Dock ----------
const dockApps = [
    { title: "Finder", icon: ICONS.finder, onOpen: () => openAppWindow("Finder", null, { folder: finderItems, icon: ICONS.finder }) },
    { title: "Navigateur", icon: ICONS.safari, url: "./pages/navigateur.html" },
    { title: "Profil", icon: ICONS.profil, url: "./pages/profil.html" },
    { title: "Contact", icon: ICONS.mail, url: "./pages/contact.html" },
    { title: "LinkedIn", icon: ICONS.linkedin, external: LINKEDIN_URL },
    { title: "GitHub", icon: ICONS.github, external: GITHUB_URL },
    { title: "CV", icon: ICONS.cv, url: "./assets/documents/cv_yassir_bizguirne.pdf" },
    { title: "Projets", icon: ICONS.folder, onOpen: () => openAppWindow("Projets", null, { folder: projectItems, icon: ICONS.folder }) },
    { title: "Terminal", icon: ICONS.terminal, onOpen: () => openAppWindow("Terminal", null, { terminal: true, icon: ICONS.terminal }) }
];

function buildDock() {
    const dockIcons = document.getElementById("dock-icons");

    dockApps.forEach((app) => {
        const tile = document.createElement("div");
        tile.className = "dock-icon";
        tile.dataset.title = app.title;
        tile.innerHTML = `
            <img src="${app.icon}" alt="${app.title}">
            <span class="tooltip">${app.title}</span>
            <span class="indicator"></span>
        `;
        tile.addEventListener("click", () => {
            if (app.external) {
                openExternal(app.external);
                return;
            }
            if (app.onOpen) {
                app.onOpen();
                return;
            }
            openAppWindow(app.title, app.url, { icon: app.icon });
        });
        dockIcons.appendChild(tile);
    });

    // Séparateur
    const separator = document.createElement("div");
    separator.className = "dock-separator";
    dockIcons.appendChild(separator);

    // Corbeille
    const trash = document.createElement("div");
    trash.className = "dock-icon";
    trash.dataset.title = "Corbeille";
    trash.innerHTML = `
        <img src="${ICONS.trash}" alt="Corbeille">
        <span class="tooltip">Corbeille</span>
        <span class="indicator"></span>
    `;
    trash.addEventListener("click", () => {
        trash.classList.add("dock-bounce");
        setTimeout(() => trash.classList.remove("dock-bounce"), 400);
    });
    dockIcons.appendChild(trash);

    setupDockMagnify();
}

function setupDockMagnify() {
    const dock = document.getElementById("dock");
    const row = document.getElementById("dock-icons");

    const RANGE = 150; // distance (px) sur laquelle la magnification agit
    const MAX_SCALE = 1.55;

    const getTiles = () => [...row.querySelectorAll(".dock-icon")];

    let transformed = false;
    const resetTransforms = () => {
        if (!transformed) {
            return;
        }
        transformed = false;
        getTiles().forEach((tile) => {
            tile.style.transform = "";
            const img = tile.querySelector("img");
            if (img) {
                img.style.transform = "";
            }
        });
    };

    const applyMagnify = (mouseX) => {
        const tiles = getTiles();
        if (tiles.length === 0) {
            return;
        }

        // mouseX est en coordonnées viewport ; on se repositionne dans la rangée
        const rowRect = row.getBoundingClientRect();
        const mx = mouseX - rowRect.left;

        // Positions de base (layout flex non transformé)
        const baseLeft = tiles.map((tile) => tile.offsetLeft);
        const baseWidth = tiles.map((tile) => tile.offsetWidth);
        const baseCenter = tiles.map((tile, i) => baseLeft[i] + baseWidth[i] / 2);

        // Échelle de chaque icône selon la distance au curseur
        const scales = baseCenter.map((center) => {
            const dist = Math.abs(mx - center);
            return dist < RANGE ? 1 + (1 - dist / RANGE) * (MAX_SCALE - 1) : 1;
        });

        const scaledWidth = tiles.map((tile, i) => baseWidth[i] * scales[i]);

        // Écart réel entre chaque paire d'icônes (gère séparateur, marges, mini-tuiles)
        const baseGap = [];
        for (let i = 0; i < tiles.length - 1; i += 1) {
            baseGap[i] = baseLeft[i + 1] - (baseLeft[i] + baseWidth[i]);
        }
        // L'écart grandit proportionnellement à l'agrandissement de ses deux voisines
        const scaledGap = baseGap.map((gap, i) => gap * ((scales[i] + scales[i + 1]) / 2));

        const totalScaled = scaledWidth.reduce((a, b) => a + b, 0) + scaledGap.reduce((a, b) => a + b, 0);

        // Le centre du groupe reste fixe : les icônes s'écartent au lieu de se superposer.
        // À l'échelle 1, chaque translateX vaut exactement 0 (aucun décalage parasite).
        const groupCenter = (baseCenter[0] + baseCenter[tiles.length - 1]) / 2;
        let x = groupCenter - totalScaled / 2;

        tiles.forEach((tile, i) => {
            tile.style.transform = `translateX(${(x - baseLeft[i]).toFixed(1)}px)`;
            const img = tile.querySelector("img");
            if (img) {
                img.style.transform = `scale(${scales[i].toFixed(3)})`;
            }
            if (i < tiles.length - 1) {
                x += scaledWidth[i] + scaledGap[i];
            }
        });
    };

    // La magnification s'active/désactive en direct, à chaque mouvement de
    // souris : désactivée au toucher, sur petit écran (dock scrollable) ou
    // avec prefers-reduced-motion. Aucune dépendance aux événements
    // resize/matchMedia (fiabilité maximale, y compris rotation d'écran).
    const shouldEnable = () =>
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        && !window.matchMedia("(pointer: coarse)").matches
        && window.innerWidth >= 680;

    // Zone de survol étendue au-dessus du dock : les icônes se réinitialisent
    // seulement quand le curseur quitte vraiment la zone (pas de clignotement).
    const onMouseMove = (event) => {
        if (!shouldEnable()) {
            resetTransforms();
            return;
        }
        const dockRect = dock.getBoundingClientRect();
        const inBand = event.clientY >= dockRect.top - 60 && event.clientY <= dockRect.bottom + 12;
        if (!inBand) {
            resetTransforms();
            return;
        }
        applyMagnify(event.clientX);
        transformed = true;
    };

    document.addEventListener("mousemove", onMouseMove);
}

// ---------- Fenêtre OS ----------
class WindowApp {
    constructor(title, url, opts = {}) {
        this.title = title;
        this.url = url;
        this.opts = opts;
        this.icon = opts.icon || ICONS.folder;
        this.windowElement = null;
        this.miniTile = null;
        this.isMaximized = false;
        this.isMinimized = false;
        this.prevConfig = { top: "", left: "", width: "", height: "" };

        this.createWindow();
        this.setupInteractions();
        this.focusWindow();
        openWindows.set(this.title, this);
        this.markDockRunning(true);
    }

    createWindow() {
        this.windowElement = document.createElement("div");
        this.windowElement.className = "os-window";
        const pos = nextWindowPosition();
        this.windowElement.style.top = `${pos.top}px`;
        this.windowElement.style.left = `${pos.left}px`;

        let content = "";
        if (this.opts.terminal) {
            content = `<div class="terminal-window" id="term-body">
                <div class="term-out"></div>
                <div class="term-inline">
                    <span class="term-prompt">➜ ~</span>
                    <input class="term-input" type="text" autocomplete="off" spellcheck="false">
                </div>
            </div>`;
        } else if (this.opts.folder) {
            content = `<div class="folder-content"></div>`;
        } else {
            content = `<iframe class="window-content" src="${this.url}" title="${this.title}"></iframe>`;
        }

        this.windowElement.innerHTML = `
            <div class="window-header">
                <div class="window-controls">
                    <button class="tl-btn tl-red" title="Fermer"><svg viewBox="0 0 10 10"><path d="M2.5 2.5l5 5M7.5 2.5l-5 5" stroke="#4a0000" stroke-width="1.5" stroke-linecap="round"/></svg></button>
                    <button class="tl-btn tl-yellow" title="Réduire"><svg viewBox="0 0 10 10"><path d="M2 5h6" stroke="#5c4700" stroke-width="1.5" stroke-linecap="round"/></svg></button>
                    <button class="tl-btn tl-green" title="Plein écran"><svg viewBox="0 0 10 10"><path d="M5 2v6M2 5h6" stroke="#0a5a10" stroke-width="1.5" stroke-linecap="round"/></svg></button>
                </div>
                <div class="window-title">${this.title}</div>
            </div>
            ${content}
        `;

        document.getElementById("desktop").appendChild(this.windowElement);

        if (this.opts.folder) {
            const contentEl = this.windowElement.querySelector(".folder-content");
            this.opts.folder.forEach((item) => {
                const icon = createDesktopIcon(item.icon, item.name, item.url, item.onOpen);
                contentEl.appendChild(icon);
            });
        }

        if (this.opts.terminal) {
            this.setupTerminal();
        }
    }

    markDockRunning(running) {
        const tile = document.querySelector(`.dock-icon[data-title="${this.title}"]`);
        if (tile) {
            tile.classList.toggle("running", running);
        }
    }

    focusWindow() {
        highestZIndex += 1;
        this.windowElement.style.zIndex = highestZIndex;
        document.querySelectorAll(".os-window").forEach((w) => w.classList.remove("is-focused"));
        this.windowElement.classList.add("is-focused");

        if (this.isMinimized) {
            this.removeMiniTile();
            this.windowElement.classList.remove("is-minimized");
            this.isMinimized = false;
        }
    }

    minimizeWindow() {
        if (this.isMinimized) {
            return;
        }
        this.windowElement.classList.add("is-minimized");
        this.isMinimized = true;
        this.createMiniTile();
    }

    restoreWindow() {
        this.focusWindow();
    }

    createMiniTile() {
        const dockIcons = document.getElementById("dock-icons");
        const separator = dockIcons.querySelector(".dock-separator");
        this.miniTile = document.createElement("div");
        this.miniTile.className = "dock-icon dock-mini";
        this.miniTile.dataset.miniTitle = this.title;
        this.miniTile.innerHTML = `
            <img src="${this.icon}" alt="${this.title}">
            <span class="tooltip">${this.title}</span>
        `;
        this.miniTile.addEventListener("click", () => this.restoreWindow());
        dockIcons.insertBefore(this.miniTile, separator);
    }

    removeMiniTile() {
        if (this.miniTile) {
            this.miniTile.remove();
            this.miniTile = null;
        }
    }

    toggleMaximize() {
        if (!this.isMaximized) {
            this.prevConfig = {
                top: this.windowElement.style.top,
                left: this.windowElement.style.left,
                width: this.windowElement.style.width,
                height: this.windowElement.style.height
            };
            this.windowElement.classList.add("is-maximized");
            this.isMaximized = true;
            return;
        }
        this.windowElement.classList.remove("is-maximized");
        this.windowElement.style.top = this.prevConfig.top || "64px";
        this.windowElement.style.left = this.prevConfig.left || "100px";
        this.windowElement.style.width = this.prevConfig.width || "680px";
        this.windowElement.style.height = this.prevConfig.height || "460px";
        this.isMaximized = false;
    }

    closeWindow() {
        this.windowElement.remove();
        this.removeMiniTile();
        this.markDockRunning(false);
        openWindows.delete(this.title);
    }

    setupInteractions() {
        const header = this.windowElement.querySelector(".window-header");
        const closeBtn = this.windowElement.querySelector(".tl-red");
        const minimizeBtn = this.windowElement.querySelector(".tl-yellow");
        const maximizeBtn = this.windowElement.querySelector(".tl-green");

        // Focus au pointerdown (souris + tactile)
        this.windowElement.addEventListener("pointerdown", () => this.focusWindow());

        let isDragging = false;
        let offsetX = 0;
        let offsetY = 0;

        const onPointerMove = (event) => {
            if (!isDragging) {
                return;
            }
            this.windowElement.style.left = `${event.clientX - offsetX}px`;
            this.windowElement.style.top = `${event.clientY - offsetY}px`;
        };
        const endDrag = () => {
            if (!isDragging) {
                return;
            }
            isDragging = false;
            this.windowElement.classList.remove("is-interacting");
        };

        header.addEventListener("pointermove", onPointerMove);
        header.addEventListener("pointerup", endDrag);
        header.addEventListener("pointercancel", endDrag);

        closeBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            this.closeWindow();
        });

        minimizeBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            this.minimizeWindow();
        });

        maximizeBtn.addEventListener("click", (event) => {
            event.stopPropagation();
            this.toggleMaximize();
        });
        header.addEventListener("dblclick", () => this.toggleMaximize());

        // Drag de la fenêtre par la barre de titre (souris ET doigt)
        header.addEventListener("pointerdown", (event) => {
            if (this.isMaximized || event.target.closest(".tl-btn")) {
                return;
            }
            isDragging = true;
            offsetX = event.clientX - this.windowElement.getBoundingClientRect().left;
            offsetY = event.clientY - this.windowElement.getBoundingClientRect().top;
            this.windowElement.classList.add("is-interacting");
            try {
                header.setPointerCapture(event.pointerId);
            } catch { /* ignore */ }
        });
    }

    setupTerminal() {
        const body = this.windowElement.querySelector("#term-body");
        const out = body.querySelector(".term-out");
        const input = body.querySelector(".term-input");
        const username = "yassir";
        const host = "macbook-pro";

        const print = (text, cls = "") => {
            const line = document.createElement("div");
            if (cls) {
                line.className = cls;
            }
            line.textContent = text;
            out.appendChild(line);
            body.scrollTop = body.scrollHeight;
        };

        const greeting = [
            `Last login: ${new Date().toDateString()} on ttys000`,
            `Bienvenue sur Mac OS X Leopard 10.5.8`,
            `Tapez « help » pour la liste des commandes.`,
            ""
        ];
        greeting.forEach((line) => print(line));

        const commands = {
            help: () => [
                "Commandes disponibles :",
                "  help          — cette aide",
                "  whoami        — qui suis-je",
                "  date          — date et heure",
                "  ls            — contenu du dossier",
                "  pwd           — dossier courant",
                "  uname         — version du système",
                "  open <app>    — ouvre une app (profil, contact, projets, navigateur, cv)",
                "  echo <texte>  — affiche du texte",
                "  sudo ...      — pas pour toi 😉",
                "  clear         — efface le terminal"
            ],
            whoami: () => [`${username}`],
            date: () => [new Date().toString()],
            ls: () => ["Applications   Bureau   Documents   Projets   CV.pdf"],
            pwd: () => [`/Users/${username}`],
            uname: () => ["Darwin 9.8.0 Darwin Kernel Version 9.8.0: Wed Jul 15 16:55:01 PDT 2009; root:xnu-1228.15.4~1/RELEASE_I386 i386"],
            echo: (args) => [args.join(" ")],
            clear: () => {
                out.innerHTML = "";
                return [];
            }
        };

        const appAliases = {
            profil: () => openAppWindow("Profil", "./pages/profil.html", { icon: ICONS.profil }),
            contact: () => openAppWindow("Contact", "./pages/contact.html", { icon: ICONS.mail }),
            projets: () => openAppWindow("Projets", null, { folder: projectItems, icon: ICONS.folder }),
            navigateur: () => openAppWindow("Navigateur", "./pages/navigateur.html", { icon: ICONS.safari }),
            cv: () => openAppWindow("CV", "./assets/documents/cv_yassir_bizguirne.pdf", { icon: ICONS.cv })
        };

        input.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") {
                return;
            }
            const raw = input.value.trim();
            input.value = "";
            print(`➜ ~ ${raw}`, "term-cmd");

            if (!raw) {
                return;
            }

            const [cmd, ...args] = raw.split(/\s+/);
            const lower = cmd.toLowerCase();

            if (lower === "open") {
                const target = (args[0] || "").toLowerCase();
                if (appAliases[target]) {
                    appAliases[target]();
                    print(`Ouverture de « ${target} »…`);
                } else {
                    print(`open: « ${target} » introuvable. Essayez : ${Object.keys(appAliases).join(", ")}`);
                }
                return;
            }

            if (lower === "sudo") {
                print(`${username} is not in the sudoers file. This incident will be reported.`);
                return;
            }

            const handler = commands[lower];
            if (handler) {
                (handler(args) || []).forEach((line) => print(line));
            } else {
                print(`-bash: ${cmd}: commande introuvable`);
            }
        });

        setTimeout(() => input.focus(), 150);
        body.addEventListener("mousedown", () => input.focus());
        body.addEventListener("pointerdown", () => input.focus());
    }
}

// ---------- Bureau ----------
class DesktopEnvironment {
    constructor(containerId) {
        this.desktop = document.getElementById(containerId);
        this.applyCellSize();
        this.init();
    }

    applyCellSize() {
        // Cellules plus compactes sur petit écran pour que le bureau tienne à l'écran
        if (window.innerWidth < 640) {
            this.cellW = 104;
            this.cellH = 122;
        } else {
            this.cellW = 126;
            this.cellH = 148;
        }
    }

    init() {
        this.generateGrid();
        this.populateInitialIcons();
        this.setupDragAndDrop();
        this.desktop.addEventListener("mousedown", () => {
            document.querySelectorAll(".desktop-icon.selected").forEach((el) => el.classList.remove("selected"));
        });
        window.addEventListener("resize", () => {
            this.applyCellSize();
            this.generateGrid(true);
        });
    }

    generateGrid(isResize = false) {
        const safety = 18;
        const minCols = window.innerWidth < 480 ? 3 : 5;
        const cols = Math.max(minCols, Math.floor((window.innerWidth - safety) / this.cellW) - 1);
        // Sur petit écran, 3 lignes minimum pour que les 7 icônes du bureau tiennent
        const minRows = window.innerWidth < 480 ? 3 : 2;
        const rows = Math.max(minRows, Math.floor((window.innerHeight - 160) / this.cellH) - 1);

        this.desktop.style.setProperty("--cell-w", `${this.cellW}px`);
        this.desktop.style.setProperty("--cell-h", `${this.cellH}px`);
        this.desktop.style.gridTemplateColumns = `repeat(${cols}, ${this.cellW}px)`;
        this.desktop.style.gridTemplateRows = `repeat(${rows}, ${this.cellH}px)`;

        if (isResize) {
            // Au redimensionnement : on ajoute seulement les cellules manquantes
            // (sans détruire les icônes déjà placées).
            this.ensureCellCount(cols, rows);
            return;
        }

        this.desktop.innerHTML = "";
        for (let index = 0; index < cols * rows; index += 1) {
            const cell = document.createElement("div");
            cell.classList.add("grid-cell");
            this.desktop.appendChild(cell);
        }
    }

    ensureCellCount(cols, rows) {
        const needed = cols * rows;
        const current = this.desktop.querySelectorAll(".grid-cell").length;
        for (let index = current; index < needed; index += 1) {
            const cell = document.createElement("div");
            cell.classList.add("grid-cell");
            this.desktop.appendChild(cell);
        }
    }

    populateInitialIcons() {
        const defs = [
            { cell: 0, name: "Projets", icon: ICONS.folder, onOpen: () => openAppWindow("Projets", null, { folder: projectItems, icon: ICONS.folder }) },
            { cell: 1, name: "Navigateur", icon: ICONS.safari, url: "./pages/navigateur.html" },
            { cell: 2, name: "Profil", icon: ICONS.profil, url: "./pages/profil.html" },
            { cell: 3, name: "Contact", icon: ICONS.mail, url: "./pages/contact.html" },
            { cell: 4, name: "LinkedIn", icon: ICONS.linkedin, external: LINKEDIN_URL },
            { cell: 5, name: "GitHub", icon: ICONS.github, external: GITHUB_URL },
            { cell: 6, name: "CV", icon: ICONS.cv, url: "./assets/documents/cv_yassir_bizguirne.pdf" }
        ];

        defs.forEach((def) => {
            this.addIcon(def.cell, def.icon, def.name, def.url, def.onOpen, def.external);
        });
    }

    addIcon(cellIndex, icon, name, url, onOpen, external) {
        const cells = this.desktop.querySelectorAll(".grid-cell");
        // Si la cellule ciblée n'existe pas (écran étroit) ou est occupée,
        // on place l'icône dans la première cellule libre.
        let target = cells[cellIndex];
        if (!target || target.hasChildNodes()) {
            target = [...cells].find((cell) => !cell.hasChildNodes());
        }
        if (!target) {
            return;
        }

        const iconEl = createDesktopIcon(icon, name, url, onOpen || (external ? () => openExternal(external) : undefined), { drag: true });
        target.appendChild(iconEl);
    }

    setupDragAndDrop() {
        this.desktop.addEventListener("dragover", (event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
        });

        this.desktop.addEventListener("dragenter", (event) => {
            event.preventDefault();
            const cell = event.target.closest(".grid-cell");
            if (cell && !cell.querySelector(".desktop-icon")) {
                cell.classList.add("drag-over");
            }
        });

        this.desktop.addEventListener("dragleave", (event) => {
            const cell = event.target.closest(".grid-cell");
            if (cell) {
                cell.classList.remove("drag-over");
            }
        });

        this.desktop.addEventListener("drop", (event) => {
            event.preventDefault();
            const cell = event.target.closest(".grid-cell");
            if (cell) {
                cell.classList.remove("drag-over");
                const icon = dragState.icon;
                if (!cell.querySelector(".desktop-icon") && icon) {
                    cell.appendChild(icon);
                    restoreIconOpacity(icon);
                    dragState.icon = null;
                }
            }
        });
    }
}

// ---------- Barre de menus : horloge ----------
function startMenuClock() {
    const dateEl = document.getElementById("menubar-date");
    const clockEl = document.getElementById("menubar-clock");
    const update = () => {
        const now = new Date();
        const days = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
        const months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
        const pad = (n) => (n < 10 ? "0" : "") + n;
        dateEl.textContent = `${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
        clockEl.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    };
    update();
    setInterval(update, 1000);
}

document.addEventListener("DOMContentLoaded", () => {
    new DesktopEnvironment("desktop");
    buildDock();
    startMenuClock();
});
