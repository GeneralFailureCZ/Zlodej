/**
 * ZLODĚJ – Card Game
 * game.js – Vlákno 1: Datové struktury a inicializace
 * ──────────────────────────────────────────────────────
 * Tento soubor obsahuje:
 *   1. Lokalizační objekt LANG
 *   2. Konfiguraci CONFIG a herní konstanty
 *   3. Vytvoření balíčku (createDeck)
 *   4. Zamíchání (shuffle – Fisher-Yates)
 *   5. Herní stav gameState
 *   6. Inicializaci hry (initGame)
 *   7. Debug výstup do stránky
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
  },
  cs: {
    playerName:   "Hráč",
    aiName:       "Počítač",
    draw:         "Dobírací balíček",
    discard:      "Odhazovací balíček",
    scorePile:    "Bodovací balíček",
    joker:        "Žolík",
  }
};

let currentLang = "en";

// T() vždy vrátí aktivní překlad – funguje správně i po přepnutí jazyka
const T = () => LANG[currentLang];


// ── 2. Konfigurace a konstanty ─────────────────────────────────────────────

const CONFIG = {
  HAND_SIZE:        6,        // karet v ruce na začátku kola
  DECKS:            2,        // počet francouzských balíčků
  JOKERS_PER_DECK:  2,        // žolíků v jednom balíčku
  ANIMATION_SPEED: "normal",  // slow | normal | fast | off
};

const SUITS = ["♠", "♥", "♦", "♣"];

// Žolík je poslední – slice(0, -1) ho odřízne při iteraci normálních karet
const RANKS = ["2","3","4","5","6","7","8","9","10","J","Q","K","A","Joker"];

const CARD_VALUES = {
  "Joker": 50,
  "A":     20,
  "K": 10, "Q": 10, "J": 10, "10": 10,
  "9":  5, "8":  5, "7":  5, "6":  5,
  "5":  5, "4":  5, "3":  5, "2":  5,
};


// ── 3. Vytvoření balíčku ───────────────────────────────────────────────────

/**
 * Vytvoří nový nezamíchaný balíček (nebo více balíčků dle CONFIG.DECKS).
 * Každá karta je objekt { suit, rank, value, id }.
 * id je globálně unikátní – nutné kvůli duplicitám ze dvou balíčků.
 */
function createDeck() {
  const deck = [];
  let idCounter = 0;

  for (let d = 0; d < CONFIG.DECKS; d++) {
    // Normální karty: 4 barvy × 13 hodnot = 52 karet na balíček
    for (const suit of SUITS) {
      for (const rank of RANKS.slice(0, -1)) { // vše kromě Jokeru
        deck.push({
          suit:  suit,
          rank:  rank,
          value: CARD_VALUES[rank],
          id:    idCounter++,
        });
      }
    }
    // Žolíci: 2 na balíček, suit = null
    for (let j = 0; j < CONFIG.JOKERS_PER_DECK; j++) {
      deck.push({
        suit:  null,
        rank:  "Joker",
        value: 50,
        id:    idCounter++,
      });
    }
  }

  return deck; // celkem 108 karet
}


// ── 4. Zamíchání (Fisher-Yates) ────────────────────────────────────────────

/**
 * Zamíchá pole na místě (mutuje original) a vrátí ho.
 * Fisher-Yates garantuje rovnoměrně náhodnou permutaci.
 * Pozn.: array.sort(() => Math.random() - 0.5) je statisticky nesprávné.
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]]; // ES6 destructuring swap
  }
  return array;
}


// ── 5. Herní stav ──────────────────────────────────────────────────────────

// Deklarujeme proměnnou – initGame() ji vždy přepíše celou
let gameState = null;


// ── 6. Vytvoření hráče ────────────────────────────────────────────────────

/**
 * Tovární funkce pro hráče.
 * @param {number}  index   - pořadí hráče (0 = člověk)
 * @param {boolean} isHuman - true pro lidského hráče
 */
function createPlayer(index, isHuman) {
  return {
    index:        index,
    isHuman:      isHuman,
    name:         isHuman ? T().playerName : T().aiName,
    hand:         [],     // karty aktuálně v ruce
    scorePile:    [],     // pole skupin: [ [karta, karta], [karta], ... ]
    totalScore:   0,      // průběžný součet bodů ze scorePile
    inCommitment: false,  // je hráč ve fázi závazku?
  };
}


// ── 7. Inicializace hry ────────────────────────────────────────────────────

/**
 * Vytvoří nový herní stav pro daný počet hráčů.
 * Hráč na indexu 0 je vždy člověk, ostatní jsou AI.
 * @param {number} numPlayers - počet hráčů (2–4), výchozí 2
 */
function initGame(numPlayers = 2) {
  const deck = shuffle(createDeck());

  const players = [];
  for (let i = 0; i < numPlayers; i++) {
    players.push(createPlayer(i, i === 0));
  }

  gameState = {
    players:            players,
    drawPile:           deck,       // zamíchaný dobírací balíček
    discardPile:        [],         // odhazovací balíček – začíná prázdný
    currentPlayerIndex: 0,          // los se dořeší v vláknu 2
    currentRound:       1,
    subTurnIndex:       0,          // 0–5: kolikáté podkolo v kole
    phase:              "init",     // init | dealing | playing | roundEnd | gameEnd
    seriesScores:       players.map(() => 0),  // průběžné skóre série
    commitment:         null,       // { playerIndex, card } nebo null
  };

  console.log("✅ Game initialized:", gameState);
  console.log("🃏 Deck size:", gameState.drawPile.length);

  renderDebug();
}


// ── 8. Debug výstup na stránku ────────────────────────────────────────────

/**
 * Vyplní #debug-output základními ověřovacími informacemi.
 * Tato funkce bude v pozdějších vláknech nahrazena herním UI.
 */
function renderDebug() {
  const container = document.getElementById("debug-output");
  if (!container || !gameState) return;

  const deckSize    = gameState.drawPile.length;
  const deckOk      = deckSize === 108;
  const idsUnique   = new Set(gameState.drawPile.map(c => c.id)).size === deckSize;
  const jokerCount  = gameState.drawPile.filter(c => c.rank === "Joker").length;
  const jokersOk    = jokerCount === CONFIG.DECKS * CONFIG.JOKERS_PER_DECK;

  const rows = [
    {
      label: "Deck size",
      value: deckSize,
      status: deckOk ? "ok" : "warn",
      note: deckOk ? "✓ 108 cards" : "✗ expected 108",
    },
    {
      label: "Unique IDs",
      value: idsUnique ? "All unique" : "COLLISION",
      status: idsUnique ? "ok" : "warn",
    },
    {
      label: "Jokers",
      value: jokerCount,
      status: jokersOk ? "ok" : "warn",
      note: jokersOk ? `✓ ${CONFIG.DECKS} decks × ${CONFIG.JOKERS_PER_DECK}` : "✗ mismatch",
    },
    {
      label: "Players",
      value: gameState.players.map(p => p.name).join(", "),
      status: "info",
    },
    {
      label: "Phase",
      value: gameState.phase,
      status: "info",
    },
    {
      label: "Language",
      value: currentLang.toUpperCase(),
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
