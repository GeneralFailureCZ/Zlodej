/**
 * ZLODĚJ – Card Game
 * game.js – Vlákno 1 + 2: Datové struktury, inicializace, rozdávání
 * ──────────────────────────────────────────────────────────────────
 * Vlákno 1:
 *   1. Lokalizační objekt LANG
 *   2. Konfigurace CONFIG a herní konstanty
 *   3. Vytvoření balíčku (createDeck)
 *   4. Zamíchání (shuffle – Fisher-Yates)
 *   5. Herní stav gameState
 *   6. Vytvoření hráče (createPlayer)
 *   7. Inicializace hry (initGame)
 *
 * Vlákno 2:
 *   8. Přesun karty (moveCard)
 *   9. Rozdání karet (dealCards)
 *  10. Start hry (startGame)
 *  11. Debug výstup na stránku (renderDebug)
 */

// ── 1. Lokalizace ──────────────────────────────────────────────────────────

const LANG = {
  en: {
    playerName:   "Player",
    aiName:       "Computer",
    draw:         "Draw pile",
    discard:      "Discard pile",
    scorePile:    "Score pile",
    joker:        "Joker",
    dealtCards:   "Cards dealt",
    firstPlayer:  "Goes first",
  },
  cs: {
    playerName:   "Hráč",
    aiName:       "Počítač",
    draw:         "Dobírací balíček",
    discard:      "Odhazovací balíček",
    scorePile:    "Bodovací balíček",
    joker:        "Žolík",
    dealtCards:   "Rozdané karty",
    firstPlayer:  "Začíná",
  }
};

let currentLang = "en";

// T() vždy vrátí aktivní překlad
const T = () => LANG[currentLang];


// ── 2. Konfigurace a konstanty ─────────────────────────────────────────────

const CONFIG = {
  HAND_SIZE:        6,
  DECKS:            2,
  JOKERS_PER_DECK:  2,
  ANIMATION_SPEED: "normal",  // slow | normal | fast | off
};

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A","Joker"];

const CARD_VALUES = {
  "Joker": 50,
  "A":     20,
  "K": 10, "Q": 10, "J": 10, "10": 10,
  "9":  5, "8":  5, "7":  5, "6":  5,
  "5":  5, "4":  5, "3":  5, "2":  5,
};


// ── 3. Vytvoření balíčku ───────────────────────────────────────────────────

function createDeck() {
  const deck = [];
  let idCounter = 0;

  for (let d = 0; d < CONFIG.DECKS; d++) {
    for (const suit of SUITS) {
      for (const rank of RANKS.slice(0, -1)) {
        deck.push({
          suit:  suit,
          rank:  rank,
          value: CARD_VALUES[rank],
          id:    idCounter++,
        });
      }
    }
    for (let j = 0; j < CONFIG.JOKERS_PER_DECK; j++) {
      deck.push({
        suit:  null,
        rank:  "Joker",
        value: 50,
        id:    idCounter++,
      });
    }
  }

  return deck;
}


// ── 4. Zamíchání (Fisher-Yates) ────────────────────────────────────────────

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


// ── 5. Herní stav ──────────────────────────────────────────────────────────

let gameState = null;


// ── 6. Vytvoření hráče ────────────────────────────────────────────────────

function createPlayer(index, isHuman) {
  return {
    index:        index,
    isHuman:      isHuman,
    name:         isHuman ? T().playerName : T().aiName,
    hand:         [],
    scorePile:    [],
    totalScore:   0,
    inCommitment: false,
  };
}


// ── 7. Inicializace hry ────────────────────────────────────────────────────

function initGame(numPlayers = 2) {
  const deck = shuffle(createDeck());

  const players = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push(createPlayer(i, i === 0));
  }

  gameState = {
    players:            players,
    drawPile:           deck,
    discardPile:        [],
    currentPlayerIndex: 0,
    currentRound:       1,
    subTurnIndex:       0,
    phase:              "init",
    seriesScores:       players.map(() => 0),
    seriesFirstPlayer:  0,   // index hráče který začal aktuální hru v sérii
    commitment:         null,
  };

  console.log("✅ Game initialized:", gameState);
}


// ── 8. Přesun karty ────────────────────────────────────────────────────────

/**
 * Vezme kartu z vrchu pole `from` a přidá ji na konec pole `to`.
 * Tato funkce je centrální bod pro všechny přesuny karet v celé hře.
 * Sem v budoucnu přidáme animaci – a bude fungovat všude najednou.
 *
 * @param {Array} from  - pole ze kterého bereme (např. gameState.drawPile)
 * @param {Array} to    - pole kam dáváme (např. player.hand)
 * @returns {Object}    - přesunutá karta (užitečné pro animace a logování)
 */
function moveCard(from, to) {
  // splice(-1, 1) vyjme poslední prvek pole a vrátí ho jako pole s jedním prvkem
  // [0] na konci z toho pole vytáhne přímo kartu
  const card = from.splice(-1, 1)[0];
  to.push(card);
  return card;
}


// ── 9. Rozdání karet ───────────────────────────────────────────────────────

/**
 * Rozdá každému hráči CONFIG.HAND_SIZE karet z dobíracího balíčku.
 * Karty se rozdávají po jedné každému hráči (jako ve skutečné hře),
 * ne najednou celý balík jednomu hráči.
 *
 * Proč po jedné? Férovost a konzistence s budoucí animací rozdávání.
 */
function dealCards() {
  for (let card = 0; card < CONFIG.HAND_SIZE; card++) {
    for (const player of gameState.players) {
      // Pokud by dobírací balíček náhodou došel, bereme z odhazovacího
      // (pravidlo: odhazovací se nikdy nemíchá)
      const source = gameState.drawPile.length > 0
        ? gameState.drawPile
        : gameState.discardPile;

      moveCard(source, player.hand);
    }
  }

  console.log("🃏 Cards dealt:");
  gameState.players.forEach(p => {
    console.log(`  ${p.name}: ${p.hand.length} cards`, p.hand);
  });
}


// ── 10. Start hry ─────────────────────────────────────────────────────────

/**
 * Spustí hru: vylosuje prvního hráče, rozdá karty, přepne fázi.
 * Tato funkce se volá jednou na začátku každé hry v sérii.
 * Při první hře losuje náhodně, při dalších rotuje o 1.
 *
 * @param {boolean} isFirstGameInSeries - true = losovat, false = rotovat
 */
function startGame(isFirstGameInSeries = true) {
  if (isFirstGameInSeries) {
    // Los: náhodné celé číslo od 0 do počtu hráčů - 1
    gameState.currentPlayerIndex = Math.floor(Math.random() * gameState.players.length);
  } else {
    // Rotace: posun o 1, modulo zajistí přetočení zpět na 0
    gameState.currentPlayerIndex =
      (gameState.seriesFirstPlayer + 1) % gameState.players.length;
  }

  // Uložíme kdo začal tuto hru v sérii (pro příští rotaci)
  gameState.seriesFirstPlayer = gameState.currentPlayerIndex;

  dealCards();

  gameState.phase = "playing";

  console.log(`🎲 First player: ${gameState.players[gameState.currentPlayerIndex].name}`);
  console.log("▶️  Phase:", gameState.phase);

  renderDebug();
}


// ── 11. Debug výstup na stránku ───────────────────────────────────────────

function renderDebug() {
  const container = document.getElementById("debug-output");
  if (!container || !gameState) return;

  const deckSize   = gameState.drawPile.length;
  const firstPlayer = gameState.players[gameState.currentPlayerIndex];

  // Sestavíme řádky pro každého hráče – kolik karet má v ruce
  const playerRows = gameState.players.map(p => ({
    label:  `${p.name} – hand`,
    value:  `${p.hand.length} cards`,
    status: p.hand.length === CONFIG.HAND_SIZE ? "ok" : "warn",
    note:   p.hand.map(c => c.suit ? `${c.rank}${c.suit}` : c.rank).join("  "),
  }));

  const rows = [
    {
      label:  "Phase",
      value:  gameState.phase,
      status: gameState.phase === "playing" ? "ok" : "info",
    },
    {
      label:  T().firstPlayer,
      value:  firstPlayer ? firstPlayer.name : "—",
      status: "info",
    },
    {
      label:  "Draw pile remaining",
      value:  `${deckSize} cards`,
      status: deckSize === 108 - CONFIG.HAND_SIZE * gameState.players.length ? "ok" : "warn",
    },
    ...playerRows,
    {
      label:  "Language",
      value:  currentLang.toUpperCase(),
      status: "info",
    },
  ];

  container.innerHTML = rows.map(row => `
    <div class="debug-row">
      <span class="debug-label">${row.label}</span>
      <span class="debug-value ${row.status}">
        ${row.value}${row.note ? " — " + row.note : ""}
      </span>
    </div>
  `).join("");
}


// ── Spuštění ───────────────────────────────────────────────────────────────

initGame(2);
startGame(true);
