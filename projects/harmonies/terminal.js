/* ============================================================
   Harmonies — version console dans le navigateur
   ------------------------------------------------------------
   Port JavaScript FIDÈLE de la version Terminal (CLI) du projet
   LO21 (C++). Mêmes menus, mêmes règles, même affichage :

     - Setup : nombre de joueurs (1-4), côté A/B, option
       "Esprit de la nature", noms des joueurs, premier joueur.
     - Plateau central (marché) : slots de 3 jetons.
     - Plateau personnel hexagonal (convention even-q offset,
       faces A et B comme dans PersonalBoard.cpp).
     - Règles d'empilement (PlacementValidator.cpp) et de
       motifs (PatternMatcher.cpp, rotations 60°).
     - Cartes animales et esprits de la nature identiques à
       DefaultDeckFactory.cpp.
     - Scoring : LandscapeScoreCalculator, AnimalCardScore,
       NatureSpiritScore, évaluation solo en soleils.

   Le code source C++ d'origine se trouve dans /LO21projet
   (main_console.cpp, ConsoleInputHandler.cpp, ...).
   ============================================================ */

(function () {
    "use strict";

    // ============================================================
    // Coordonnées hexagonales (convention even-q offset)
    // ============================================================
    function HexCoord(q, r) {
        this.q = q;
        this.r = r;
    }
    HexCoord.prototype.key = function () { return this.q + "," + this.r; };
    HexCoord.prototype.eq = function (o) { return this.q === o.q && this.r === o.r; };
    HexCoord.prototype.clone = function () { return new HexCoord(this.q, this.r); };

    function toCube(c) {
        var q = c.q, r = c.r;
        var z = r - (q + (q & 1)) / 2;
        var x = q;
        return { x: x, y: -x - z, z: z };
    }
    function fromCube(c) {
        return new HexCoord(c.x, c.z + (c.x + (c.x & 1)) / 2);
    }
    // Voisin dans une direction (mêmes règles que hexCoord.cpp)
    var DIR = { Up: 0, UpRight: 1, DownRight: 2, Down: 3, DownLeft: 4, UpLeft: 5 };
    function neighborInDirection(coord, direction) {
        var even = (coord.q % 2 === 0);
        switch (direction) {
            case DIR.Up:    return new HexCoord(coord.q, coord.r - 1);
            case DIR.Down:  return new HexCoord(coord.q, coord.r + 1);
            case DIR.UpRight:   return even ? new HexCoord(coord.q + 1, coord.r) : new HexCoord(coord.q + 1, coord.r - 1);
            case DIR.DownRight: return even ? new HexCoord(coord.q + 1, coord.r + 1) : new HexCoord(coord.q + 1, coord.r);
            case DIR.DownLeft:  return even ? new HexCoord(coord.q - 1, coord.r + 1) : new HexCoord(coord.q - 1, coord.r);
            case DIR.UpLeft:    return even ? new HexCoord(coord.q - 1, coord.r) : new HexCoord(coord.q - 1, coord.r - 1);
        }
        return coord.clone();
    }
    function advanceInDirection(coord, direction, distance) {
        var current = coord;
        for (var i = 0; i < distance; i++) current = neighborInDirection(current, direction);
        return current;
    }
    function addPatternOffset(anchor, offset) {
        var a = toCube(anchor), o = toCube(offset);
        return fromCube({ x: a.x + o.x, y: a.y + o.y, z: a.z + o.z });
    }
    function rotateCubeClockwise(c) { return { x: -c.z, y: -c.x, z: -c.y }; }
    function rotateOffset(offset, steps) {
        steps = ((steps % 6) + 6) % 6;
        var rotated = toCube(offset);
        for (var i = 0; i < steps; i++) rotated = rotateCubeClockwise(rotated);
        return fromCube(rotated);
    }
    function hexNeighbors(coord) {
        return [neighborInDirection(coord, DIR.Up), neighborInDirection(coord, DIR.UpRight),
                neighborInDirection(coord, DIR.DownRight), neighborInDirection(coord, DIR.Down),
                neighborInDirection(coord, DIR.DownLeft), neighborInDirection(coord, DIR.UpLeft)];
    }

    // ============================================================
    // Jetons
    // ============================================================
    var Token = {
        W: "W", // BlueWater
        S: "S", // GrayStone
        E: "E", // BrownEarth
        T: "T", // GreenTree
        F: "F", // YellowField
        B: "B"  // RedBuilding
    };
    var ALL_TOKENS = [Token.W, Token.S, Token.E, Token.T, Token.F, Token.B];

    // ============================================================
    // Motifs (Pattern) + rotations
    // ============================================================
    function PatternCell(offset, type, height) {
        this.offset = offset; this.type = type; this.height = height || 0;
    }
    function Pattern(cells) { this.cells = cells; }
    Pattern.prototype.rotated = function (steps) {
        var out = [];
        for (var i = 0; i < this.cells.length; i++) {
            var c = this.cells[i];
            out.push(new PatternCell(rotateOffset(c.offset, steps), c.type, c.height));
        }
        return new Pattern(out);
    };

    // ============================================================
    // Cartes animales (DefaultDeckFactory.cpp — mêmes motifs)
    // ============================================================
    function AnimalCard(name, pattern, slotValues) {
        this.name = name;
        this.pattern = pattern;
        this.slotValues = slotValues;
        this.cubesOnCard = slotValues.length;
    }
    AnimalCard.prototype.totalSlots = function () { return this.slotValues.length; };
    AnimalCard.prototype.isComplete = function () { return this.cubesOnCard === 0; };
    AnimalCard.prototype.nextSlotValue = function () { return this.slotValues[this.totalSlots() - this.cubesOnCard]; };
    AnimalCard.prototype.placeNextCube = function () { if (this.cubesOnCard > 0) { this.cubesOnCard--; return true; } return false; };

    function makePattern(cells) { return new Pattern(cells); }
    function step(dir, distance) { return advanceInDirection(new HexCoord(0, 0), dir, distance); }
    function pc(offset, type, height) { return new PatternCell(offset, type, height); }
    function H(q, r) { return new HexCoord(q, r); }

    function makeDefaultAnimalCards() {
        return [
            new AnimalCard("fennec",  makePattern([pc(step(DIR.UpLeft, 2), Token.F, 1), pc(step(DIR.UpLeft, 1), Token.S, 1), pc(H(0, 0), Token.S, 1)]), [4, 9, 16]),
            new AnimalCard("raven",   makePattern([pc(H(0, 0), Token.F, 1), pc(H(-1, 0), Token.B, 2), pc(H(1, 0), Token.B, 2)]), [4, 9]),
            new AnimalCard("raven2",  makePattern([pc(H(0, 0), Token.F, 1), pc(H(-1, 0), Token.B, 2), pc(H(1, 0), Token.B, 2)]), [3, 6, 11, 17]),
            new AnimalCard("squirrel",makePattern([pc(H(-1, 0), Token.T, 3), pc(H(0, 0), Token.B, 2)]), [4, 9, 15]),
            new AnimalCard("parrot",  makePattern([pc(H(-1, 0), Token.W, 1), pc(H(-1, 1), Token.W, 1), pc(H(0, 0), Token.T, 2)]), [4, 9, 14]),
            new AnimalCard("duck",    makePattern([pc(H(-1, 0), Token.B, 2), pc(H(0, 0), Token.W, 1)]), [2, 4, 8, 13]),
            new AnimalCard("fox",     makePattern([pc(step(DIR.UpLeft, 2), Token.T, 2), pc(step(DIR.UpLeft, 1), Token.W, 1), pc(H(0, 0), Token.S, 3)]), [2, 4, 9, 16]),
            new AnimalCard("otter",   makePattern([pc(step(DIR.UpLeft, 1), Token.W, 1), pc(H(0, 0), Token.W, 1), pc(step(DIR.DownRight, 1), Token.W, 1)]), [1, 4, 8, 14]),
            new AnimalCard("deer",    makePattern([pc(step(DIR.UpLeft, 2), Token.T, 2), pc(step(DIR.UpLeft, 1), Token.T, 2), pc(H(0, 0), Token.F, 1)]), [2, 5, 10, 15]),
            new AnimalCard("goat",    makePattern([pc(H(0, 0), Token.S, 3), pc(step(DIR.DownRight, 1), Token.W, 1), pc(step(DIR.DownRight, 2), Token.T, 2)]), [3, 7, 12, 18])
        ];
    }

    // ============================================================
    // Esprits de la nature (DefaultDeckFactory.cpp)
    // ============================================================
    function ConnectedGroupRule(type, minSize, maxSize, score) {
        this.type = type; this.minGroupSize = minSize; this.maxGroupSize = maxSize; this.score = score;
    }
    function NatureSpiritCard(name, pattern, connectedRules) {
        this.name = name;
        this.pattern = pattern;
        this.connectedRules = connectedRules;
        this.cubePlaced = false;
    }
    NatureSpiritCard.prototype.isCubePlaced = function () { return this.cubePlaced; };
    NatureSpiritCard.prototype.placeCube = function () { if (this.cubePlaced) return false; this.cubePlaced = true; return true; };

    function makeDefaultNatureSpiritCards() {
        return [
            new NatureSpiritCard("brook", makePattern([pc(H(-2, -1), Token.W, 1), pc(H(-1, 0), Token.W, 1), pc(H(0, 0), Token.F, 1)]),
                [new ConnectedGroupRule(Token.W, 1, 1, 2), new ConnectedGroupRule(Token.W, 2, 2, 5), new ConnectedGroupRule(Token.W, 3, 0, 9)]),
            new NatureSpiritCard("clay", makePattern([pc(H(0, 0), Token.T, 2), pc(H(1, 0), Token.B, 1)]),
                [new ConnectedGroupRule(Token.E, 1, 1, 4), new ConnectedGroupRule(Token.E, 2, 2, 8), new ConnectedGroupRule(Token.E, 3, 0, 12)]),
            new NatureSpiritCard("field", makePattern([pc(H(-1, 0), Token.F, 1), pc(H(0, 0), Token.F, 1), pc(H(1, 1), Token.F, 1)]),
                [new ConnectedGroupRule(Token.F, 1, 1, 2), new ConnectedGroupRule(Token.F, 2, 2, 4), new ConnectedGroupRule(Token.F, 3, 0, 8)]),
            new NatureSpiritCard("grove", makePattern([pc(H(0, 0), Token.T, 2), pc(H(1, 0), Token.T, 1), pc(H(2, -1), Token.F, 1)]),
                [new ConnectedGroupRule(Token.T, 1, 1, 3), new ConnectedGroupRule(Token.T, 2, 2, 6), new ConnectedGroupRule(Token.T, 3, 0, 10)]),
            new NatureSpiritCard("lion", makePattern([pc(H(-1, 0), Token.T, 2), pc(H(0, 0), Token.F, 1), pc(H(1, 1), Token.F, 1)]),
                [new ConnectedGroupRule(Token.F, 1, 2, 2), new ConnectedGroupRule(Token.F, 3, 0, 10)]),
            new NatureSpiritCard("peak", makePattern([pc(H(0, 0), Token.S, 3), pc(H(1, 0), Token.S, 2)]),
                [new ConnectedGroupRule(Token.S, 1, 1, 4), new ConnectedGroupRule(Token.S, 2, 2, 7), new ConnectedGroupRule(Token.S, 3, 0, 11)]),
            new NatureSpiritCard("spring", makePattern([pc(H(1, 0), Token.W, 1), pc(H(0, 0), Token.T, 1), pc(H(0, 1), Token.W, 1)]),
                [new ConnectedGroupRule(Token.W, 1, 1, 3), new ConnectedGroupRule(Token.W, 2, 2, 7), new ConnectedGroupRule(Token.W, 3, 0, 12)]),
            new NatureSpiritCard("tower", makePattern([pc(H(-1, 0), Token.B, 2), pc(H(0, 0), Token.F, 1), pc(H(1, 1), Token.B, 2)]),
                [new ConnectedGroupRule(Token.B, 1, 1, 5), new ConnectedGroupRule(Token.B, 2, 2, 9), new ConnectedGroupRule(Token.B, 3, 0, 14)])
        ];
    }

    // ============================================================
    // Cellule et plateaux
    // ============================================================
    function BoardCell(coord) {
        this.coord = coord;
        this.stack = [];   // max 3 jetons
        this.cube = false;
    }
    BoardCell.prototype.getHeight = function () { return this.stack.length; };
    BoardCell.prototype.getTokenStack = function () { return this.stack; };
    BoardCell.prototype.hasCube = function () { return this.cube; };
    BoardCell.prototype.canPlaceCube = function () { return this.stack.length > 0 && !this.cube; };
    BoardCell.prototype.placeCube = function () { if (!this.canPlaceCube()) return false; this.cube = true; return true; };
    BoardCell.prototype.addToken = function (type) { if (this.stack.length >= 3) return false; this.stack.push(type); return true; };

    // Règles d'empilement (PlacementValidator.cpp)
    function placementValidator(token, coord, board) {
        var cell = board.getCell(coord);
        if (!cell) return false;
        if (cell.hasCube()) return false;
        if (cell.getHeight() === 0) return true;
        if (cell.getHeight() < 3) {
            var stack = cell.getTokenStack();
            var h = cell.getHeight();
            var top = stack[h - 1];
            if (token === Token.S) return top === Token.S;
            if (token === Token.B) {
                if (h === 1) return top === Token.S || top === Token.B || top === Token.E;
                return false;
            }
            if (token === Token.E && h === 1) return top === Token.E;
            if (token === Token.T) return top === Token.E;
        }
        return false;
    }

    function PersonalBoard(side) {
        this.side = side; // "A" | "B"
        this.cells = {};  // key "q,r" -> BoardCell
        this.initializeGrid();
    }
    PersonalBoard.prototype.initializeGrid = function () {
        var columns;
        if (this.side === "A") {
            columns = [[-2, -2, 5], [-1, -1, 4], [0, -2, 5], [1, -1, 4], [2, -2, 5]];
        } else {
            columns = [[-3, -2, 4], [-2, -2, 3], [-1, -2, 4], [0, -2, 3], [1, -2, 4], [2, -2, 3], [3, -2, 4]];
        }
        for (var i = 0; i < columns.length; i++) {
            var q = columns[i][0], rStart = columns[i][1], count = columns[i][2];
            for (var j = 0; j < count; j++) {
                var c = new HexCoord(q, rStart + j);
                this.cells[c.key()] = new BoardCell(c);
            }
        }
    };
    PersonalBoard.prototype.contains = function (coord) { return !!this.cells[coord.key()]; };
    PersonalBoard.prototype.getCell = function (coord) { return this.cells[coord.key()] || null; };
    PersonalBoard.prototype.getCells = function () {
        var out = [];
        for (var k in this.cells) out.push(this.cells[k]);
        return out;
    };
    PersonalBoard.prototype.placeToken = function (coord, type) {
        var cell = this.getCell(coord);
        return cell ? cell.addToken(type) : false;
    };
    PersonalBoard.prototype.getAdjacentCells = function (coord) {
        var out = [];
        var nbs = hexNeighbors(coord);
        for (var i = 0; i < nbs.length; i++) {
            var c = this.getCell(nbs[i]);
            if (c) out.push(c);
        }
        return out;
    };
    PersonalBoard.prototype.countEmpty = function () {
        var n = 0;
        for (var k in this.cells) if (this.cells[k].getHeight() === 0) n++;
        return n;
    };

    function CentralBoard(nbPlayers) {
        this.slots = [];
        var nb = (nbPlayers === 1) ? 3 : 5;
        for (var i = 0; i < nb; i++) this.slots.push([]);
    }
    CentralBoard.prototype.getNbSlots = function () { return this.slots.length; };
    CentralBoard.prototype.getSlot = function (i) { return this.slots[i] || null; };
    CentralBoard.prototype.slotEmpty = function (i) { return !this.slots[i] || this.slots[i].length === 0; };

    function TokenBag() {
        this.tokens = [];
        for (var i = 0; i < 20; i++) {
            for (var j = 0; j < ALL_TOKENS.length; j++) this.tokens.push(ALL_TOKENS[j]);
        }
        this.shuffle();
    }
    TokenBag.prototype.shuffle = function () {
        for (var i = this.tokens.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = this.tokens[i]; this.tokens[i] = this.tokens[j]; this.tokens[j] = tmp;
        }
    };
    TokenBag.prototype.drawTokens = function (count) {
        var drawn = [];
        for (var i = 0; i < count && this.tokens.length > 0; i++) drawn.push(this.tokens.pop());
        return drawn;
    };        TokenBag.prototype.isEmpty = function () { return this.tokens.length === 0; };

    // ============================================================
    // Joueur et collection de cartes
    // ============================================================
    function Player(name, side) {
        this.name = name;
        this.board = new PersonalBoard(side);
        this.score = 0;
        this.animalCards = [];   // cartes animales possédées
        this.natureSpiritCards = []; // cartes esprit reçues
        this.chosenSpiritIndex = -1;
        this.spiritCubePlaced = false;
    }
    Player.prototype.addAnimalCard = function (card) { this.animalCards.push(card); };
    Player.prototype.getActiveAnimalCardCount = function () {
        var n = 0;
        for (var i = 0; i < this.animalCards.length; i++) if (!this.animalCards[i].isComplete()) n++;
        return n;
    };
    Player.prototype.addNatureSpiritCard = function (card) { this.natureSpiritCards.push(card); };
    Player.prototype.getNatureSpiritCardCount = function () { return this.natureSpiritCards.length; };
    Player.prototype.chooseNatureSpiritCard = function (index) {
        if (index < 0 || index >= this.natureSpiritCards.length) return false;
        if (this.natureSpiritCards.length <= 1) return false;
        var chosen = this.natureSpiritCards[index];
        this.natureSpiritCards = [chosen]; // garde seulement la carte choisie
        this.chosenSpiritIndex = 0;
        return true;
    };
    Player.prototype.hasUnplacedChosenNatureSpiritCard = function () {
        return this.natureSpiritCards.length === 1 && !this.natureSpiritCards[0].isCubePlaced();
    };
    Player.prototype.getNatureSpiritCard = function (index) { return this.natureSpiritCards[index] || null; };

    // ============================================================
    // Motifs : correspondance (PatternMatcher.cpp)
    // ============================================================
    function matches(board, anchor, pattern) {
        for (var i = 0; i < pattern.cells.length; i++) {
            var p = pattern.cells[i];
            var target = addPatternOffset(anchor, p.offset);
            if (!board.contains(target)) return false;
            var cell = board.getCell(target);
            var stack = cell.getTokenStack();
            if (stack.length === 0 || stack[stack.length - 1] !== p.type) return false;
            if (p.height !== 0 && cell.getHeight() !== p.height) return false;
        }
        return true;
    }
    function matchesAnyRotation(board, anchor, pattern) {
        for (var i = 0; i < 6; i++) {
            if (matches(board, anchor, pattern.rotated(i))) return true;
        }
        return false;
    }

    // ============================================================
    // Jeu (Game.cpp — états, actions, transitions)
    // ============================================================
    var State = { NotStarted: 0, WaitingForSlotChoice: 1, WaitingForPlacement: 2, WaitingForTurnEndChoice: 3, GameOver: 4 };

    function Game(config, playerNames) {
        this.config = config;
        this.players = [];
        for (var i = 0; i < playerNames.length; i++) {
            this.players.push(new Player(playerNames[i], config.side));
        }
        this.tokenBag = new TokenBag();
        this.centralBoard = new CentralBoard(config.nbPlayer);
        this.animalCards = this.buildAnimalDeck();
        this.visibleAnimalCards = [];
        this.spiritDeck = makeDefaultNatureSpiritCards().sort(function () { return Math.random() - 0.5; });
        this.turn = 1;
        this.currentPlayerIndex = 0;
        this.state = State.NotStarted;
        this.finalRoundTriggered = false;
        this.pendingTokens = [];
        this.hasTakenAnimalCard = false;
        this.hasReplacedAnimalCard = false;
    }
    Game.prototype.buildAnimalDeck = function () {
        var templates = makeDefaultAnimalCards();
        var cards = [];
        for (var copy = 0; copy < 3; copy++) {
            for (var i = 0; i < templates.length; i++) cards.push(templates[i]);
        }
        // mélange
        for (var j = cards.length - 1; j > 0; j--) {
            var k = Math.floor(Math.random() * (j + 1));
            var t = cards[j]; cards[j] = cards[k]; cards[k] = t;
        }
        return cards;
    };
    Game.prototype.visibleSlotCount = function () { return this.config.nbPlayer === 1 ? 3 : 5; };
    Game.prototype.refillVisible = function () {
        while (this.visibleAnimalCards.length < this.visibleSlotCount() && this.animalCards.length > 0) {
            this.visibleAnimalCards.push(this.animalCards.pop());
        }
    };
    Game.prototype.initGame = function () {
        // Distribution des esprits (2 par joueur si option activée)
        if (this.config.spirit) {
            for (var i = 0; i < this.players.length; i++) {
                if (this.spiritDeck.length >= 2) {
                    this.players[i].addNatureSpiritCard(this.spiritDeck.pop());
                    this.players[i].addNatureSpiritCard(this.spiritDeck.pop());
                }
            }
        }
        // Remplissage du marché
        for (var j = 0; j < this.centralBoard.getNbSlots(); j++) {
            this.centralBoard.slots[j] = this.tokenBag.drawTokens(3);
        }
        this.refillVisible();
        this.state = State.WaitingForSlotChoice;
        this.finalRoundTriggered = false;
    };
    Game.prototype.getCurrentPlayer = function () { return this.players[this.currentPlayerIndex]; };
    Game.prototype.isNatureSpiritEnabled = function () { return this.config.spirit; };
    Game.prototype.isFinalRoundTriggered = function () { return this.finalRoundTriggered; };
    Game.prototype.isGameOver = function () { return this.state === State.GameOver; };
    Game.prototype.canTakeVisibleAnimalCard = function () {
        if (this.hasTakenAnimalCard || this.hasReplacedAnimalCard) return false;
        var MAX_ACTIVE = 4;
        var cp = this.getCurrentPlayer();
        var active = cp.getActiveAnimalCardCount() + (cp.hasUnplacedChosenNatureSpiritCard() ? 1 : 0);
        return active < MAX_ACTIVE && this.visibleAnimalCards.length > 0;
    };
    Game.prototype.canReplaceVisibleAnimalCard = function () {
        return this.state === State.WaitingForTurnEndChoice &&
               this.config.nbPlayer === 1 &&
               !this.hasTakenAnimalCard && !this.hasReplacedAnimalCard &&
               this.animalCards.length > 0 && this.visibleAnimalCards.length > 0;
    };

    // Actions
    Game.prototype.takeTokensFromSlot = function (slotIndex) {
        if (this.state !== State.WaitingForSlotChoice) return false;
        var slot = this.centralBoard.getSlot(slotIndex);
        if (!slot || slot.length === 0) return false;
        this.pendingTokens = slot.slice();
        slot.length = 0;
        if (this.centralBoard.getNbSlots() !== 3) {
            this.centralBoard.slots[slotIndex] = this.tokenBag.drawTokens(3);
        }
        this.state = State.WaitingForPlacement;
        return true;
    };
    Game.prototype.takeVisibleAnimalCard = function (index) {
        if (!this.canTakeVisibleAnimalCard()) return false;
        if (index < 0 || index >= this.visibleAnimalCards.length) return false;
        var card = this.visibleAnimalCards.splice(index, 1)[0];
        this.getCurrentPlayer().addAnimalCard(card);
        this.hasTakenAnimalCard = true;
        return true;
    };
    Game.prototype.replaceAnimalCard = function (index) {
        if (!this.canReplaceVisibleAnimalCard()) return false;
        if (index < 0 || index >= this.visibleAnimalCards.length) return false;
        this.visibleAnimalCards.splice(index, 1);
        this.refillVisible();
        this.hasReplacedAnimalCard = true;
        return true;
    };
    Game.prototype.placeAnimalCube = function (cardIndex, anchor) {
        var player = this.getCurrentPlayer();
        var card = player.animalCards[cardIndex];
        if (!card || card.isComplete()) return false;
        if (!matchesAnyRotation(player.board, anchor, card.pattern)) return false;
        var cell = player.board.getCell(anchor);
        if (!cell || !cell.canPlaceCube()) return false;
        card.placeNextCube();
        cell.placeCube();
        return true;
    };
    Game.prototype.chooseNatureSpiritCard = function (index) {
        if (!this.config.spirit) return false;
        if (this.turn !== 1) return false;
        var player = this.getCurrentPlayer();
        if (player.getNatureSpiritCardCount() <= 1) return false;
        return player.chooseNatureSpiritCard(index);
    };
    Game.prototype.placeNatureSpiritCube = function (anchor) {
        if (!this.config.spirit) return false;
        var player = this.getCurrentPlayer();
        if (player.getNatureSpiritCardCount() !== 1) return false;
        var card = player.getNatureSpiritCard(0);
        if (!card || card.isCubePlaced()) return false;
        if (!matchesAnyRotation(player.board, anchor, card.pattern)) return false;
        var cell = player.board.getCell(anchor);
        if (!cell || !cell.canPlaceCube()) return false;
        card.placeCube();
        cell.placeCube();
        return true;
    };
    Game.prototype.placeTokenOnBoard = function (coord, token) {
        if (this.state !== State.WaitingForPlacement) return false;
        var idx = this.pendingTokens.indexOf(token);
        if (idx === -1) return false;
        var board = this.getCurrentPlayer().board;
        if (!placementValidator(token, coord, board)) return false;
        board.placeToken(coord, token);
        this.pendingTokens.splice(idx, 1);
        if (this.pendingTokens.length === 0) this.state = State.WaitingForTurnEndChoice;
        return true;
    };
    Game.prototype.endTurn = function () {
        if (this.state !== State.WaitingForTurnEndChoice) return false;
        if (this.config.spirit && this.turn === 1 && this.getCurrentPlayer().getNatureSpiritCardCount() > 1) {
            return false; // il faut d'abord choisir son esprit
        }
        this.finishTurn();
        return true;
    };
    Game.prototype.finishTurn = function () {
        if (this.config.nbPlayer === 1) {
            // resetSoloMarket : vider et re-remplir les 3 slots
            for (var i = 0; i < this.centralBoard.getNbSlots(); i++) {
                this.centralBoard.slots[i] = this.tokenBag.drawTokens(3);
            }
        }
        this.currentPlayerIndex++;
        if (this.currentPlayerIndex >= this.players.length) {
            this.currentPlayerIndex = 0;
            this.turn++;
        }
        this.refillVisible();
        this.pendingTokens = [];
        this.hasTakenAnimalCard = false;
        this.hasReplacedAnimalCard = false;
        this.state = State.WaitingForSlotChoice;
        this.checkEndGame();
    };
    Game.prototype.checkEndGame = function () {
        var bagEmpty = this.tokenBag.isEmpty();
        var boardNearlyFull = false;
        for (var i = 0; i < this.players.length; i++) {
            if (this.players[i].board.countEmpty() <= 2) boardNearlyFull = true;
        }
        if (bagEmpty || boardNearlyFull) this.finalRoundTriggered = true;
        if (this.finalRoundTriggered && this.currentPlayerIndex === 0) {
            this.state = State.GameOver;
            for (var j = 0; j < this.players.length; j++) {
                this.players[j].score = this.calculatePlayerScore(this.players[j]);
            }
        }
    };

    // ============================================================
    // Scoring (fidèle à LandscapeScoreCalculator.cpp, etc.)
    // ============================================================
    function stackHeightScore(height) {
        if (height === 1) return 1;
        if (height === 2) return 3;
        if (height === 3) return 7;
        return 0;
    }
    function riverScore(length) {
        if (length <= 1) return 0;
        if (length === 2) return 2;
        if (length === 3) return 5;
        if (length === 4) return 8;
        if (length === 5) return 11;
        if (length === 6) return 15;
        return 15 + 4 * (length - 6);
    }
    function stackTypeOf(cell) {
        if (cell.getHeight() === 0) return "Empty";
        var top = cell.getTokenStack()[cell.getHeight() - 1];
        if (top === Token.T) return "Tree";
        if (top === Token.S) return "Mountain";
        if (top === Token.F) return "Field";
        if (top === Token.W) return "Water";
        if (top === Token.B) return "Building";
        return "Incomplete";
    }
    function computeTreeScore(board) {
        var s = 0;
        var cells = board.getCells();
        for (var i = 0; i < cells.length; i++) {
            if (stackTypeOf(cells[i]) === "Tree") s += stackHeightScore(cells[i].getHeight());
        }
        return s;
    }
    function computeMountainScore(board) {
        var s = 0;
        var cells = board.getCells();
        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i];
            if (stackTypeOf(cell) !== "Mountain") continue;
            var nbs = board.getAdjacentCells(cell.coord);
            var hasNeighbor = false;
            for (var j = 0; j < nbs.length; j++) {
                if (stackTypeOf(nbs[j]) === "Mountain") { hasNeighbor = true; break; }
            }
            if (hasNeighbor) s += stackHeightScore(cell.getHeight());
        }
        return s;
    }
    function computeFieldScore(board) {
        var s = 0, visited = {};
        var cells = board.getCells();
        for (var i = 0; i < cells.length; i++) {
            var start = cells[i];
            if (visited[start.coord.key()] || stackTypeOf(start) !== "Field") continue;
            var frontier = [start.coord.key()];
            visited[start.coord.key()] = true;
            var size = 0;
            while (frontier.length) {
                var key = frontier.pop();
                var cur = board.getCell(new HexCoord(parseInt(key.split(",")[0], 10), parseInt(key.split(",")[1], 10)));
                size++;
                var nbs = board.getAdjacentCells(cur.coord);
                for (var j = 0; j < nbs.length; j++) {
                    var nk = nbs[j].coord.key();
                    if (!visited[nk] && stackTypeOf(nbs[j]) === "Field") {
                        visited[nk] = true;
                        frontier.push(nk);
                    }
                }
            }
            if (size >= 2) s += 5;
        }
        return s;
    }
    function computeBuildingScore(board) {
        var s = 0;
        var cells = board.getCells();
        for (var i = 0; i < cells.length; i++) {
            var cell = cells[i];
            if (stackTypeOf(cell) !== "Building") continue;
            var nbs = board.getAdjacentCells(cell.coord);
            var colors = {};
            for (var j = 0; j < nbs.length; j++) {
                if (nbs[j].getHeight() > 0) {
                    colors[nbs[j].getTokenStack()[nbs[j].getHeight() - 1]] = true;
                }
            }
            var nbColors = 0;
            for (var c in colors) nbColors++;
            if (nbColors >= 3) s += 5;
        }
        return s;
    }
    function computeLongestRiverLength(board) {
        var longest = 0;
        var visited = {};
        var cells = board.getCells();
        for (var i = 0; i < cells.length; i++) {
            var start = cells[i];
            if (visited[start.coord.key()] || stackTypeOf(start) !== "Water") continue;
            var component = [];
            var frontier = [start.coord.key()];
            visited[start.coord.key()] = true;
            while (frontier.length) {
                var key = frontier.pop();
                component.push(key);
                var cur = board.getCell(new HexCoord(parseInt(key.split(",")[0], 10), parseInt(key.split(",")[1], 10)));
                var nbs = board.getAdjacentCells(cur.coord);
                for (var j = 0; j < nbs.length; j++) {
                    var nk = nbs[j].coord.key();
                    if (!visited[nk] && stackTypeOf(nbs[j]) === "Water") {
                        visited[nk] = true;
                        frontier.push(nk);
                    }
                }
            }
            for (var c = 0; c < component.length; c++) {
                var dist = {};
                dist[component[c]] = 1;
                var q = [component[c]];
                while (q.length) {
                    var k2 = q.pop();
                    var cell2 = board.getCell(new HexCoord(parseInt(k2.split(",")[0], 10), parseInt(k2.split(",")[1], 10)));
                    var n2 = board.getAdjacentCells(cell2.coord);
                    for (var j2 = 0; j2 < n2.length; j2++) {
                        var nk2 = n2[j2].coord.key();
                        if (stackTypeOf(n2[j2]) === "Water" && !(nk2 in dist)) {
                            dist[nk2] = dist[k2] + 1;
                            q.push(nk2);
                        }
                    }
                }
                for (var dk in dist) longest = Math.max(longest, dist[dk]);
            }
        }
        return longest;
    }
    function computeIslandScore(board) {
        var count = 0;
        var visited = {};
        var cells = board.getCells();
        for (var i = 0; i < cells.length; i++) {
            var start = cells[i];
            if (visited[start.coord.key()] || stackTypeOf(start) === "Water") continue;
            visited[start.coord.key()] = true;
            var frontier = [start.coord.key()];
            count++;
            while (frontier.length) {
                var key = frontier.pop();
                var cur = board.getCell(new HexCoord(parseInt(key.split(",")[0], 10), parseInt(key.split(",")[1], 10)));
                var nbs = board.getAdjacentCells(cur.coord);
                for (var j = 0; j < nbs.length; j++) {
                    var nk = nbs[j].coord.key();
                    if (!visited[nk] && stackTypeOf(nbs[j]) !== "Water") {
                        visited[nk] = true;
                        frontier.push(nk);
                    }
                }
            }
        }
        return count * 5;
    }
    function landscapeScore(board) {
        var s = 0;
        s += computeTreeScore(board);
        s += computeMountainScore(board);
        s += computeFieldScore(board);
        s += computeBuildingScore(board);
        if (board.side === "A") s += riverScore(computeLongestRiverLength(board));
        else s += computeIslandScore(board);
        return s;
    }
    function animalCardScore(card) {
        var placed = card.totalSlots() - card.cubesOnCard;
        if (placed === 0) return 0;
        return card.slotValues[placed - 1];
    }
    function groupSizeMatches(groupSize, rule) {
        if (groupSize < rule.minGroupSize) return false;
        return rule.maxGroupSize === 0 || groupSize <= rule.maxGroupSize;
    }
    function matchesConnectedType(cell, type) {
        return cell.getHeight() > 0 && cell.getTokenStack()[cell.getHeight() - 1] === type;
    }
    function natureSpiritScore(card, board) {
        if (!card.isCubePlaced()) return 0;
        var rules = card.connectedRules;
        var score = 0;
        var processedTypes = {};
        for (var i = 0; i < rules.length; i++) {
            var currentType = rules[i].type;
            if (processedTypes[currentType]) continue;
            processedTypes[currentType] = true;
            var visited = {};
            var cells = board.getCells();
            for (var c = 0; c < cells.length; c++) {
                var startCoord = cells[c].coord;
                if (visited[startCoord.key()] || !matchesConnectedType(cells[c], currentType)) continue;
                visited[startCoord.key()] = true;
                var frontier = [startCoord.key()];
                var groupSize = 0;
                while (frontier.length) {
                    var key = frontier.pop();
                    groupSize++;
                    var cur = board.getCell(new HexCoord(parseInt(key.split(",")[0], 10), parseInt(key.split(",")[1], 10)));
                    var nbs = board.getAdjacentCells(cur.coord);
                    for (var j = 0; j < nbs.length; j++) {
                        var nk = nbs[j].coord.key();
                        if (!visited[nk] && matchesConnectedType(nbs[j], currentType)) {
                            visited[nk] = true;
                            frontier.push(nk);
                        }
                    }
                }
                for (var j2 = 0; j2 < rules.length; j2++) {
                    if (rules[j2].type === currentType && groupSizeMatches(groupSize, rules[j2])) {
                        score += rules[j2].score;
                    }
                }
            }
        }
        return score;
    }
    Game.prototype.calculatePlayerScore = function (player) {
        var total = landscapeScore(player.board);
        for (var i = 0; i < player.animalCards.length; i++) total += animalCardScore(player.animalCards[i]);
        for (var j = 0; j < player.natureSpiritCards.length; j++) total += natureSpiritScore(player.natureSpiritCards[j], player.board);
        return total;
    };
    function evaluateSoloScore(totalScore, side, hasSpirit) {
        var suns = 0;
        if (totalScore >= 160) suns += 8;
        else if (totalScore >= 150) suns += 7;
        else if (totalScore >= 140) suns += 6;
        else if (totalScore >= 130) suns += 5;
        else if (totalScore >= 110) suns += 4;
        else if (totalScore >= 90) suns += 3;
        else if (totalScore >= 70) suns += 2;
        else if (totalScore >= 40) suns += 1;
        if (side === "A") suns += 1;
        suns += hasSpirit ? 1 : 2;
        return suns;
    }

    // ============================================================
    // Rendu console (ConsoleRenderer.cpp — mêmes sorties)
    // ============================================================
    function tokenToChar(type) { return type; }

    function displayCentralBoard(board, println) {
        println("=== Central Board ===");
        for (var i = 0; i < board.getNbSlots(); i++) {
            var slot = board.getSlot(i);
            var line = "Slot " + i + ": ";
            if (!slot || slot.length === 0) line += "(empty)";
            else line += slot.join(" ");
            println(line);
        }
    }

    function displayPersonalBoard(board, println) {
        var cells = board.getCells();
        if (cells.length === 0) { println("(empty board)"); return; }
        var qMin = Infinity, qMax = -Infinity;
        var colRMin = {}, colRMax = {};
        for (var i = 0; i < cells.length; i++) {
            var q = cells[i].coord.q, r = cells[i].coord.r;
            if (q < qMin) qMin = q;
            if (q > qMax) qMax = q;
            if (!(q in colRMin)) { colRMin[q] = r; colRMax[q] = r; }
            else {
                colRMin[q] = Math.min(colRMin[q], r);
                colRMax[q] = Math.max(colRMax[q], r);
            }
        }
        var numCols = qMax - qMin + 1;
        var rMinEven = Infinity, rMaxEven = -Infinity, rMinOdd = Infinity, rMaxOdd = -Infinity;
        for (var qk in colRMin) {
            var idx = parseInt(qk, 10) - qMin;
            if (idx % 2 === 0) {
                rMinEven = Math.min(rMinEven, colRMin[qk]);
                rMaxEven = Math.max(rMaxEven, colRMax[qk]);
            } else {
                rMinOdd = Math.min(rMinOdd, colRMin[qk]);
                rMaxOdd = Math.max(rMaxOdd, colRMax[qk]);
            }
        }
        var maxLine = 0;
        if (rMaxEven !== -Infinity) maxLine = Math.max(maxLine, (rMaxEven - rMinEven) * 2);
        if (rMaxOdd !== -Infinity) maxLine = Math.max(maxLine, (rMaxOdd - rMinOdd) * 2 + 1);

        var grid = {};
        for (var g = 0; g < cells.length; g++) {
            var cq = cells[g].coord.q, cr = cells[g].coord.r;
            var cidx = cq - qMin;
            var vline = (cidx % 2 === 0) ? (cr - rMinEven) * 2 : (cr - rMinOdd) * 2 + 1;
            if (!grid[vline]) grid[vline] = {};
            grid[vline][cidx] = cells[g];
        }
        var side = board.side;
        println("=== Personal Board (Side " + side + ") ===");
        for (var v = 0; v <= maxLine; v++) {
            var firstCell = -1, lastCell = -1;
            if (grid[v]) {
                for (var s in grid[v]) {
                    var si = parseInt(s, 10);
                    if (firstCell === -1) firstCell = si;
                    lastCell = si;
                }
            }
            var row = "";
            for (var idx2 = 0; idx2 < numCols; idx2++) {
                var has = grid[v] && (idx2 in grid[v]);
                if (has) {
                    var cell = grid[v][idx2];
                    var stack = cell.getTokenStack();
                    var c0 = stack.length >= 1 ? tokenToChar(stack[0]) : ".";
                    var c1 = stack.length >= 2 ? tokenToChar(stack[1]) : ".";
                    var c2 = stack.length >= 3 ? tokenToChar(stack[2]) : ".";
                    if (cell.hasCube()) {
                        if (stack.length >= 3) c2 = c2.toLowerCase();
                        else if (stack.length >= 2) c1 = c1.toLowerCase();
                        else if (stack.length >= 1) c0 = c0.toLowerCase();
                    }
                    row += "[" + c0 + c1 + c2 + "]";
                } else if (firstCell !== -1 && idx2 > firstCell && idx2 < lastCell) {
                    row += "   |   ";
                } else {
                    row += "      ";
                }
            }
            println(row);
        }
        println("Legend: W=Water S=Stone E=Earth T=Tree F=Field B=Building ; lowercase=cube on top  [...]=unfilled slot");
        println("|: Separator between columns");
    }

    // ============================================================
    // Terminal xterm.js
    // ============================================================
    var term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: '"Courier New", monospace',
        theme: {
            background: "#000000",
            foreground: "#00ff66",
            cursor: "#00ff66",
            selectionBackground: "#003300"
        },
        convertEol: true
    });
    var fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(document.getElementById("terminal"));
    fitAddon.fit();
    window.addEventListener("resize", function () { fitAddon.fit(); });

    function print(text) { term.write(text); }
    function println(text) { term.writeln(text); }

    // ---------- Entrée utilisateur ligne par ligne ----------
    var awaitingInput = false;
    var onLineCallback = null;

    function askLine(promptText, callback) {
        print(promptText);
        awaitingInput = true;
        onLineCallback = callback;
    }

    var lineBuffer = "";
    term.onData(function (data) {
        if (data === "\r" || data === "\n") {
            term.write("\r\n");
            if (!awaitingInput) {
                // Entrée tapée hors prompt : on vide le buffer pour ne pas
                // polluer la prochaine saisie légitime.
                lineBuffer = "";
                return;
            }
            var line = lineBuffer;
            lineBuffer = "";
            awaitingInput = false;
            var cb = onLineCallback;
            onLineCallback = null;
            if (cb) cb(line);
        } else if (data === "\u007f" || data === "\b") {
            if (lineBuffer.length > 0) {
                lineBuffer = lineBuffer.slice(0, -1);
                term.write("\b \b");
            }
        } else if (data >= " " && data <= "~" && awaitingInput) {
            lineBuffer += data;
            term.write(data);
        }
    });

    // ---------- Helpers de saisie (fidèles à SetupMenu / ConsoleInputHandler) ----------
    function readInt(promptText, min, max, callback) {
        askLine(promptText, function (line) {
            var value = parseInt(line.trim(), 10);
            if (isNaN(value)) {
                println("  Please enter a number between " + min + " and " + max + ".");
                readInt(promptText, min, max, callback);
            } else if (value < min || value > max) {
                println("  Please enter a number between " + min + " and " + max + ".");
                readInt(promptText, min, max, callback);
            } else {
                callback(value);
            }
        });
    }
    function readIntAny(promptText, callback) {
        askLine(promptText, function (line) {
            var value = parseInt(line.trim(), 10);
            if (isNaN(value)) {
                println("Entree invalide, veuillez entrer un nombre.");
                readIntAny(promptText, callback);
            } else {
                callback(value);
            }
        });
    }
    function readChar(promptText, opt1, opt2, callback) {
        askLine(promptText, function (line) {
            var c = (line.trim().toLowerCase() || "");
            var a = opt1.toLowerCase(), b = opt2.toLowerCase();
            if (c === a) callback(opt1);
            else if (c === b) callback(opt2);
            else {
                println("  Please enter '" + opt1 + "' or '" + opt2 + "'.");
                readChar(promptText, opt1, opt2, callback);
            }
        });
    }
    function readLine(promptText, callback) {
        askLine(promptText, function (line) {
            if (line.trim() === "") {
                println("  Name cannot be empty.");
                readLine(promptText, callback);
            } else callback(line.trim());
        });
    }

    // ---------- Setup (SetupMenu.cpp) ----------
    function runSetup(callback) {
        println("=== Harmonies - Game Setup ===");
        println("");
        readInt("Number of players (1-4): ", 1, 4, function (nb) {
            readChar("Board side (A/B): ", "A", "B", function (side) {
                readChar("Enable Nature Spirit option? (y/n): ", "y", "n", function (spirit) {
                    var playerNames = [];
                    var nextName = function (i) {
                        if (i >= nb) {
                            finishSetup(nb, side, spirit === "y", playerNames, callback);
                            return;
                        }
                        readLine("Player " + (i + 1) + " name: ", function (name) {
                            if (playerNames.indexOf(name) !== -1) {
                                println("  Name '" + name + "' is already taken. Choose a different name.");
                                nextName(i);
                            } else {
                                playerNames.push(name);
                                nextName(i + 1);
                            }
                        });
                    };
                    nextName(0);
                });
            });
        });
    }

    function finishSetup(nb, side, spirit, playerNames, callback) {
        var starterIndex = 0;
        var askStarter = function () {
            if (playerNames.length > 1) {
                println("");
                println("Qui est le dernier joueur ayant vu un paysage magnifique ?");
                for (var i = 0; i < playerNames.length; i++) println("  " + (i + 1) + ". " + playerNames[i]);
                readInt("Choisissez le joueur qui commence (1-" + playerNames.length + ") : ", 1, playerNames.length, function (choice) {
                    starterIndex = choice - 1;
                    finish();
                });
            } else {
                finish();
            }
        };
        var finish = function () {
            var ordered = playerNames.slice(starterIndex).concat(playerNames.slice(0, starterIndex));
            println("");
            println("--- Setup complete ---");
            println("Players : " + nb);
            println("Board   : Side " + side);
            println("Spirit  : " + (spirit ? "enabled" : "disabled"));
            println("Starter : " + ordered[0]);
            println("Names   : " + ordered.join(", "));
            println("");
            callback({ nbPlayer: nb, side: side, spirit: spirit }, ordered);
        };
        askStarter();
    }

    // ---------- Affichages d'état (ConsoleInputHandler.cpp) ----------
    function displayVisibleAnimalCards(game, println2) {
        println2("Cartes animales visibles :");
        for (var i = 0; i < game.visibleAnimalCards.length; i++) {
            var c = game.visibleAnimalCards[i];
            println2("  [" + i + "] " + c.name + " (cubes restants: " + c.cubesOnCard + ")");
        }
    }
    function displayOwnedAnimalCards(player, println2) {
        println2("Vos cartes animales :");
        if (player.animalCards.length === 0) { println2("  (aucune)"); return; }
        for (var i = 0; i < player.animalCards.length; i++) {
            var c = player.animalCards[i];
            println2("  [" + i + "] " + c.name + " (cubes restants: " + c.cubesOnCard + ")");
        }
    }
    function displayNatureSpiritCards(player, println2) {
        println2("Vos cartes esprit de la nature :");
        if (player.natureSpiritCards.length === 0) { println2("  (aucune)"); return; }
        for (var i = 0; i < player.natureSpiritCards.length; i++) {
            var c = player.natureSpiritCards[i];
            println2("  [" + i + "] " + c.name + " (cube " + (c.isCubePlaced() ? "deja pose" : "encore sur la carte") + ")");
        }
    }
    function displayPendingTokens(game, println2) {
        println2("Jetons a poser :");
        for (var i = 0; i < game.pendingTokens.length; i++) {
            println2("  [" + i + "] " + game.pendingTokens[i]);
        }
    }
    function displayTurnHeader(game, println2) {
        var player = game.getCurrentPlayer();
        println2("");
        println2("========================================");
        println2("Tour " + game.turn + " - Joueur courant : " + player.name);
        if (game.isFinalRoundTriggered()) println2("Dernier tour : la partie se terminera a la fin de cette ronde.");
        println2("========================================");
    }

    // ---------- Boucle de jeu (ConsoleInputHandler.cpp) ----------
    function promptActions(game, list) {
        println("Actions disponibles :");
        for (var i = 0; i < list.length; i++) println("  " + list[i]);
    }

    function chooseAction(game, actions, callback) {
        readIntAny("Votre choix : ", function (choice) {
            if (actions[choice]) actions[choice](callback);
            else {
                println("Choix invalide.");
                chooseAction(game, actions, callback);
            }
        });
    }

    // Action commune : prendre une carte animale visible
    function actionTakeAnimalCard(game, onDone) {
        if (!game.canTakeVisibleAnimalCard()) { println("Prise de carte refuse."); return; }
        displayVisibleAnimalCards(game, println);
        readIntAny("Index de la carte animale visible : ", function (index) {
            if (index < 0) { println("Index invalide."); return; }
            if (game.takeVisibleAnimalCard(index)) { println("Carte animale prise."); onDone(); }
            else println("Prise de carte refusee.");
        });
    }
    // Action commune : choisir son esprit
    function actionChooseSpirit(game, onDone) {
        displayNatureSpiritCards(game.getCurrentPlayer(), println);
        readIntAny("Index de la carte esprit a conserver : ", function (index) {
            if (index < 0) { println("Index invalide."); return; }
            if (game.chooseNatureSpiritCard(index)) { println("Carte esprit choisie."); onDone(); }
            else println("Choix de carte esprit refuse.");
        });
    }
    // Action commune : poser un cube animal
    function actionPlaceAnimalCube(game, onDone) {
        displayOwnedAnimalCards(game.getCurrentPlayer(), println);
        readIntAny("Index de votre carte animale : ", function (cardIndex) {
            readIntAny("Coordonnee q de l'ancrage : ", function (q) {
                readIntAny("Coordonnee r de l'ancrage : ", function (r) {
                    if (cardIndex < 0) { println("Index invalide."); return; }
                    if (game.placeAnimalCube(cardIndex, new HexCoord(q, r))) { println("Cube animal pose."); onDone(); }
                    else println("Pose du cube animal refusee.");
                });
            });
        });
    }
    // Action commune : poser un cube esprit
    function actionPlaceSpiritCube(game, onDone) {
        readIntAny("Coordonnee q de l'ancrage esprit : ", function (q) {
            readIntAny("Coordonnee r de l'ancrage esprit : ", function (r) {
                if (game.placeNatureSpiritCube(new HexCoord(q, r))) { println("Cube esprit pose."); onDone(); }
                else println("Pose du cube esprit refusee.");
            });
        });
    }

    function stateActions(game, onDone) {
        var spirit = game.isNatureSpiritEnabled();
        if (game.state === State.WaitingForSlotChoice) {
            displayTurnHeader(game, println);
            displayCentralBoard(game.centralBoard, println);
            displayPersonalBoard(game.getCurrentPlayer().board, println);
            displayVisibleAnimalCards(game, println);
            displayOwnedAnimalCards(game.getCurrentPlayer(), println);
            if (spirit) displayNatureSpiritCards(game.getCurrentPlayer(), println);
            var actions = {};
            actions[1] = function (done) {
                readIntAny("Choisissez un slot du marche : ", function (slotIndex) {
                    if (slotIndex < 0) { println("Valeur negative invalide, veuillez entrer un nombre positif."); return; }
                    if (game.takeTokensFromSlot(slotIndex)) done();
                    else println("Choix refuse par le jeu.");
                });
            };
            actions[2] = function (done) { actionTakeAnimalCard(game, done); };
            if (spirit) {
                actions[3] = function (done) { actionChooseSpirit(game, done); };
                actions[4] = function (done) { actionPlaceAnimalCube(game, done); };
                actions[5] = function (done) { actionPlaceSpiritCube(game, done); };
                promptActions(game, [
                    "1. Prendre un slot du marche",
                    "2. Prendre une carte animale visible",
                    "3. Choisir votre carte esprit de la nature",
                    "4. Poser un cube animal",
                    "5. Poser un cube esprit de la nature"
                ]);
            } else {
                actions[3] = function (done) { actionPlaceAnimalCube(game, done); };
                promptActions(game, [
                    "1. Prendre un slot du marche",
                    "2. Prendre une carte animale visible",
                    "3. Poser un cube animal"
                ]);
            }
            chooseAction(game, actions, onDone);
        } else if (game.state === State.WaitingForPlacement) {
            displayTurnHeader(game, println);
            displayPersonalBoard(game.getCurrentPlayer().board, println);
            displayPendingTokens(game, println);
            displayOwnedAnimalCards(game.getCurrentPlayer(), println);
            if (spirit) displayNatureSpiritCards(game.getCurrentPlayer(), println);
            var actions2 = {};
            actions2[1] = function (done) {
                displayPendingTokens(game, println);
                readIntAny("Index du jeton a poser : ", function (pendingIndex) {
                    readIntAny("Coordonnee q : ", function (q) {
                        readIntAny("Coordonnee r : ", function (r) {
                            if (pendingIndex < 0 || pendingIndex >= game.pendingTokens.length) {
                                println("Index de jeton invalide."); return;
                            }
                            var token = game.pendingTokens[pendingIndex];
                            if (game.placeTokenOnBoard(new HexCoord(q, r), token)) done();
                            else println("Placement refuse par le jeu.");
                        });
                    });
                });
            };
            actions2[2] = function (done) { actionTakeAnimalCard(game, done); };
            if (spirit) {
                actions2[3] = function (done) { actionChooseSpirit(game, done); };
                actions2[4] = function (done) { actionPlaceAnimalCube(game, done); };
                actions2[5] = function (done) { actionPlaceSpiritCube(game, done); };
                promptActions(game, [
                    "1. Poser un jeton obligatoire",
                    "2. Prendre une carte animale visible",
                    "3. Choisir votre carte esprit de la nature",
                    "4. Poser un cube animal",
                    "5. Poser un cube esprit de la nature"
                ]);
            } else {
                actions2[3] = function (done) { actionPlaceAnimalCube(game, done); };
                promptActions(game, [
                    "1. Poser un jeton obligatoire",
                    "2. Prendre une carte animale visible",
                    "3. Poser un cube animal"
                ]);
            }
            chooseAction(game, actions2, onDone);
        } else if (game.state === State.WaitingForTurnEndChoice) {
            displayTurnHeader(game, println);
            displayPersonalBoard(game.getCurrentPlayer().board, println);
            displayOwnedAnimalCards(game.getCurrentPlayer(), println);
            if (spirit) displayNatureSpiritCards(game.getCurrentPlayer(), println);
            var actions3 = {};
            actions3[1] = function (done) {
                if (game.endTurn()) { println("Tour termine."); done(); }
                else println("Fin de tour refusee.");
            };
            actions3[2] = function (done) { actionTakeAnimalCard(game, done); };
            if (spirit) {
                actions3[3] = function (done) { actionChooseSpirit(game, done); };
                actions3[4] = function (done) { actionPlaceAnimalCube(game, done); };
                actions3[5] = function (done) { actionPlaceSpiritCube(game, done); };
                if (game.canReplaceVisibleAnimalCard()) {
                    actions3[6] = function (done) {
                        displayVisibleAnimalCards(game, println);
                        readIntAny("Index de la carte visible a defausser : ", function (index) {
                            if (index < 0) { println("Index invalide."); return; }
                            if (game.replaceAnimalCard(index)) { println("Carte visible defaussee et remplacee."); done(); }
                            else println("Defausse refusee.");
                        });
                    };
                }
                var list3 = [
                    "1. Terminer le tour et passer au joueur suivant",
                    "2. Prendre une carte animale visible",
                    "3. Choisir votre carte esprit de la nature",
                    "4. Poser un cube animal",
                    "5. Poser un cube esprit de la nature"
                ];
                if (game.canReplaceVisibleAnimalCard()) list3.push("6. Defausser une carte animale visible");
                promptActions(game, list3);
            } else {
                actions3[3] = function (done) { actionPlaceAnimalCube(game, done); };
                if (game.canReplaceVisibleAnimalCard()) {
                    actions3[4] = function (done) {
                        displayVisibleAnimalCards(game, println);
                        readIntAny("Index de la carte visible a defausser : ", function (index) {
                            if (index < 0) { println("Index invalide."); return; }
                            if (game.replaceAnimalCard(index)) { println("Carte visible defaussee et remplacee."); done(); }
                            else println("Defausse refusee.");
                        });
                    };
                }
                var list4 = [
                    "1. Terminer le tour et passer au joueur suivant",
                    "2. Prendre une carte animale visible",
                    "3. Poser un cube animal"
                ];
                if (game.canReplaceVisibleAnimalCard()) list4.push("4. Defausser une carte animale visible");
                promptActions(game, list4);
            }
            chooseAction(game, actions3, onDone);
        }
    }

    function displayEndGame(game, println2) {
        var ranked = game.players.slice().sort(function (a, b) { return b.score - a.score; });
        println2("");
        println2("========================================");
        println2("           FIN DE LA PARTIE             ");
        println2("========================================");
        println2("");
        println2("=== Game Over -- Final Rankings ===");
        for (var i = 0; i < ranked.length; i++) {
            var line = (i + 1) + ". " + ranked[i].name + " -- " + ranked[i].score + " pts";
            if (i === 0) line += "  ***WINNER***";
            println2(line);
        }
        // Score détaillé du vainqueur (comme displayScoreReport)
        var winner = ranked[0];
        println2("");
        println2("=== Score Report: " + winner.name + " ===");
        println2("  TOTAL:     " + winner.score);
        if (game.config.nbPlayer === 1) {
            var suns = evaluateSoloScore(winner.score, game.config.side, game.config.spirit);
            println2("");
            println2("Evaluation solo : " + winner.score + " points = " + suns + " soleil(s)");
        }
    }

    // ---------- Boot ----------
    function boot() {
        println("HARMONIES — version console");
        println("===========================");
        println("Port JavaScript du code C++ (LO21). Memes regles que l'executable harmonies_console.");
        println("Le code source : main_console.cpp, ConsoleInputHandler.cpp, ...");
        println("");
        runSetup(function (config, playerNames) {
            var game = new Game(config, playerNames);
            game.initGame();
            var loop = function () {
                if (game.isGameOver()) {
                    displayEndGame(game, println);
                    println("");
                    println("Rechargez la page pour rejouer.");
                    return;
                }
                stateActions(game, loop);
            };
            loop();
        });
    }

    // ---------- Hook WASM conservé pour le vrai binaire compilé ----------
    // Si un jour le code C++ est compilé en WebAssembly (emcc), l'entrée/sortie
    // peut être reliée au terminal à la place de ce port.
    boot();
})();
