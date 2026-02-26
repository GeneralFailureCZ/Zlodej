/**
 * ZLODĚJ – Card Game
 * game.js – Vlákno 4: Herní UI, systém dvou kliků, odhoz karty
 */

// ── 1. Lokalizace ──────────────────────────────────────────────────────────

const LANG = {
  en: {
    playerName:    "Player",
    aiName:        "Computer",
    draw:          "Draw pile",
    discard:       "Discard",
    scorePile:     "Score pile",
    joker:         "Joker",
    yourTurn:      "Your turn — select a card",
    selectTarget:  "Now choose where to play it",
    aiThinking:    "Computer is thinking…",
    discarded:     (name, card) => `${name} discarded ${card}.`,
    newRound:      (n) => `Round ${n} — cards dealt.`,
    cardsLeft:     (n) => `${n} card${n !== 1 ? "s" : ""}`,
  },
  cs: {
    playerName:    "Hráč",
    aiName:        "Počítač",
    draw:          "Dobírací balíček",
    discard:       "Odhoz",
    scorePile:     "Bodovací balíček",
    joker:         "Žolík",
    yourTurn:      "Tvůj tah — vyber kartu",
    selectTarget:  "Vyber kam kartu zahraješ",
    aiThinking:    "Počítač přemýšlí…",
    discarded:     (name, card) => `${name} odhodil ${card}.`,
    newRound:      (n) => `Kolo ${n} — rozdány karty.`,
    cardsLeft:     (n) => `${n} karet`,
  }
};

let currentLang = "en";
const T = () => LANG[currentLang];


// ── 2. Konfigurace ─────────────────────────────────────────────────────────

const CONFIG = {
  HAND_SIZE:        6,
  DECKS:            2,
  JOKERS_PER_DECK:  2,
  ANIMATION_SPEED: "normal",
  AI_DELAY_MS:      900,   // ms před tím než AI zahraje (aby to vypadalo přirozeně)
};

const SUITS  = ["♠", "♥", "♦", "♣"];
const RANKS  = ["2","3","4","5","6","7","8","9","10","J","Q","K","A","Joker"];
const RED_SUITS = new Set(["♥", "♦"]);

const CARD_VALUES = {
  "Joker": 50, "A": 20,
  "K": 10, "Q": 10, "J": 10, "10": 10,
  "9": 5, "8": 5, "7": 5, "6": 5,
  "5": 5, "4": 5, "3": 5, "2": 5,
};


// ── 3. Balíček ─────────────────────────────────────────────────────────────

function createDeck() {
  const deck = [];
  let id = 0;
  for (let d = 0; d < CONFIG.DECKS; d++) {
    for (const suit of SUITS)
      for (const rank of RANKS.slice(0, -1))
        deck.push({ suit, rank, value: CARD_VALUES[rank], id: id++ });
    for (let j = 0; j < CONFIG.JOKERS_PER_DECK; j++)
      deck.push({ suit: null, rank: "Joker", value: 50, id: id++ });
  }
  return deck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


// ── 4. Herní stav ──────────────────────────────────────────────────────────

let gameState = null;

// Aktuálně vybraná karta: { playerIndex, cardId } nebo null
let selectedCard = null;


// ── 5. Hráč ───────────────────────────────────────────────────────────────

function createPlayer(index, isHuman) {
  return {
    index,
    isHuman,
    name:         isHuman ? T().playerName : T().aiName,
    hand:         [],
    scorePile:    [],
    totalScore:   0,
    inCommitment: false,
  };
}


// ── 6. Rozdávání karet ─────────────────────────────────────────────────────

function dealCards() {
  for (const player of gameState.players) {
    for (let i = 0; i < CONFIG.HAND_SIZE; i++) {
      let card = null;
      if (gameState.drawPile.length > 0) {
        card = gameState.drawPile.pop();
      } else if (gameState.discardPile.length > 0) {
        card = gameState.discardPile.pop();
      } else {
        console.warn("Both piles empty during deal.");
        break;
      }
      player.hand.push(card);
    }
  }
  gameState.phase = "playing";
}


// ── 7. Inicializace ────────────────────────────────────────────────────────

function initGame(numPlayers = 2) {
  const deck = shuffle(createDeck());
  const players = [];
  for (let i = 0; i < numPlayers; i++)
    players.push(createPlayer(i, i === 0));

  const firstPlayer = Math.floor(Math.random() * numPlayers);

  gameState = {
    players,
    drawPile:           deck,
    discardPile:        [],
    currentPlayerIndex: firstPlayer,
    currentRound:       1,
    subTurnIndex:       0,   // 0 – (numPlayers * HAND_SIZE - 1)
    phase:              "init",
    seriesScores:       players.map(() => 0),
    commitment:         null,
  };

  console.log(`🎲 First player: ${players[firstPlayer].name} (index ${firstPlayer})`);

  dealCards();
  setStatus(T().newRound(1));
  renderAll();

  // Pokud začíná AI, nechej ji zahrát po krátké pauze
  if (!currentPlayer().isHuman) {
    scheduleAiTurn();
  }
}


// ── 8. Pomocné funkce ──────────────────────────────────────────────────────

/** Vrátí hráče který je momentálně na tahu. */
function currentPlayer() {
  return gameState.players[gameState.currentPlayerIndex];
}

/** Najde kartu v ruce hráče podle id. Vrátí { card, index } nebo null. */
function findCardInHand(playerIndex, cardId) {
  const hand = gameState.players[playerIndex].hand;
  const idx  = hand.findIndex(c => c.id === cardId);
  if (idx === -1) return null;
  return { card: hand[idx], index: idx };
}

/** Textový popis karty pro log: "K♠", "Joker" */
function cardLabel(card) {
  return card.rank === "Joker" ? T().joker : `${card.rank}${card.suit}`;
}

/** Nastaví text stavového řádku. highlight = zlatá barva na chvíli. */
function setStatus(text, highlight = false) {
  const el = document.getElementById("status-log");
  if (!el) return;
  el.textContent = text;
  if (highlight) {
    el.classList.add("highlight");
    setTimeout(() => el.classList.remove("highlight"), 1200);
  }
}


// ── 9. Akce: odhoz karty ──────────────────────────────────────────────────

/**
 * Odhodí kartu (cardId) z ruky hráče (playerIndex) na odhazovací balíček.
 *
 * Proč takhle?
 *   - Dostáváme ID, ne referenci – ID je stabilní i kdyby se pole přeskládalo
 *   - splice(index, 1) odstraní přesně jeden prvek na daném indexu
 *   - push() přidá kartu na vršek odhazovacího balíčku
 */
function discardCard(playerIndex, cardId) {
  const found = findCardInHand(playerIndex, cardId);
  if (!found) {
    console.error("Card not found in hand:", cardId);
    return false;
  }

  const { card, index } = found;
  gameState.players[playerIndex].hand.splice(index, 1);  // odeber z ruky
  gameState.discardPile.push(card);                       // polož na odhoz

  setStatus(T().discarded(gameState.players[playerIndex].name, cardLabel(card)), true);
  console.log(`🗑️  ${gameState.players[playerIndex].name} discarded ${cardLabel(card)}`);

  return true;
}


// ── 10. Posun tahu ─────────────────────────────────────────────────────────

/**
 * advanceTurn() – volá se po každé odehrané akci.
 *
 * Co dělá:
 *   1. Smaže výběr karty
 *   2. Zvýší subTurnIndex
 *   3. Přepne na dalšího hráče (rotace modulo numPlayers)
 *   4. Zkontroluje jestli kolo skončilo (všichni odehráli 6 podkol)
 *   5. Pokud kolo skončilo → rozdej nové karty
 *   6. Překresli UI
 *   7. Pokud je na tahu AI → naplánuj její tah
 */
function advanceTurn() {
  selectedCard = null;

  const numPlayers   = gameState.players.length;
  const totalSubTurns = numPlayers * CONFIG.HAND_SIZE;

  gameState.subTurnIndex++;

  // Přepni na dalšího hráče
  gameState.currentPlayerIndex =
    (gameState.currentPlayerIndex + 1) % numPlayers;

  // Konec kola?
  if (gameState.subTurnIndex >= totalSubTurns) {
    gameState.subTurnIndex = 0;
    gameState.currentRound++;

    // Zkontroluj jestli jsou oba balíčky prázdné → konec hry
    const bothEmpty = gameState.drawPile.length === 0
                   && gameState.discardPile.length === 0;
    if (bothEmpty) {
      gameState.phase = "gameEnd";
      setStatus("Game over!");
      renderAll();
      return;
    }

    dealCards();
    setStatus(T().newRound(gameState.currentRound), true);
  }

  renderAll();

  // Je na tahu AI?
  if (!currentPlayer().isHuman) {
    scheduleAiTurn();
  } else {
    setStatus(T().yourTurn);
  }
}


// ── 11. AI tah (základní – vlákno 4) ──────────────────────────────────────

/**
 * Zatím nejjednodušší možná AI: odhodí náhodnou kartu.
 * V pozdějších vláknech (AI obtížnost) tuto funkci rozšíříme.
 *
 * scheduleAiTurn() počká CONFIG.AI_DELAY_MS ms,
 * aby tah nevypadal okamžitě a hráč měl čas vidět co se děje.
 */
function scheduleAiTurn() {
  setStatus(T().aiThinking);
  setTimeout(() => {
    const ai = currentPlayer();
    if (ai.hand.length === 0) return;

    // Náhodná karta z ruky
    const randomIndex = Math.floor(Math.random() * ai.hand.length);
    const card = ai.hand[randomIndex];

    discardCard(ai.index, card.id);
    advanceTurn();
  }, CONFIG.AI_DELAY_MS);
}


// ── 12. Systém dvou kliků ─────────────────────────────────────────────────

/**
 * Klik 1 – hráč klikne na kartu v ruce.
 * Klik 2 – hráč klikne na cíl (zatím jen odhazovací balíček).
 *
 * resolveAction(targetType) dostane řetězec popisující cíl:
 *   "discard"       → odhoz
 *   "score-self"    → vlastní bodovací balíček (vlákno 5)
 *   "score-opponent"→ cizí bodovací balíček / krádež (vlákno 6)
 */

function onCardClick(playerIndex, cardId) {
  // Ignoruj klik pokud hráč není na tahu nebo fáze není playing
  if (gameState.phase !== "playing") return;
  if (!currentPlayer().isHuman) return;
  if (playerIndex !== gameState.currentPlayerIndex) return;

  if (selectedCard && selectedCard.cardId === cardId) {
    // Klikl na stejnou kartu znovu → zruš výběr
    selectedCard = null;
    setStatus(T().yourTurn);
  } else {
    // Vyber kartu
    selectedCard = { playerIndex, cardId };
    setStatus(T().selectTarget);
  }

  renderHand(gameState.players[0], "hand-player", true);
}

function onDiscardClick() {
  if (!selectedCard) return;                    // žádná karta není vybrána
  if (gameState.phase !== "playing") return;
  if (!currentPlayer().isHuman) return;

  resolveAction("discard");
}

function resolveAction(targetType) {
  if (!selectedCard) return;

  if (targetType === "discard") {
    const ok = discardCard(selectedCard.playerIndex, selectedCard.cardId);
    if (ok) {
      advanceTurn();
    }
    return;
  }

  // Ostatní typy cílů přijdou v dalších vláknech
  console.log("Target type not yet implemented:", targetType);
}


// ── 13. Renderování ────────────────────────────────────────────────────────

/** Vytvoří DOM element karty. */
function createCardElement(card, faceUp, isSelected = false) {
  const el = document.createElement("div");
  el.classList.add("card");

  if (!faceUp) {
    el.classList.add("face-down");
    return el;
  }

  el.classList.add("face-up");
  if (RED_SUITS.has(card.suit)) el.classList.add("red");
  if (card.rank === "Joker")    el.classList.add("joker");
  if (isSelected)               el.classList.add("selected");

  const label = card.rank === "Joker" ? "🃏" : `${card.rank}${card.suit}`;

  el.innerHTML = `
    <span class="corner top">${label}</span>
    <span class="center-rank">${card.rank === "Joker" ? "🃏" : card.rank}</span>
    <span class="corner bottom">${label}</span>
  `;

  return el;
}

/**
 * Vykreslí ruku hráče jako vějíř na kružnici.
 *
 * Stejná logika pro hráče i soupeře – obě ruce jsou "normální" vějíř
 * s obloukem nahoru. Soupeřovy karty jsou jen otočeny o 180° (rubem dolů).
 *
 * Algoritmus:
 *   - Střed kružnice leží RADIUS px POD spodní hranou kontejneru
 *   - Každá karta leží na této kružnici v úhlu (i - mid) * SPREAD
 *   - transform-origin = spodní střed karty → rotace vychází z "dlaně"
 *   - Výsledek: symetrický oblouk nahoru pro oba hráče
 */
function renderHand(player, containerId, clickable = false, fanDown = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const cards = player.hand;
  const count = cards.length;
  if (count === 0) return;

  const CARD_W  = 125;
  const CARD_H  = 180;
  const SPREAD  = 5;     // stupňů mezi kartami – malé = těsný vějíř
  const RADIUS  = 600;   // větší = plošší oblouk
  // Krok = kolik px se každá karta posune doprava; malé = velký překryv
  const STEP    = CARD_W * 0.18;

  const totalAngle = SPREAD * (count - 1);
  const startAngle = -totalAngle / 2;

  const containerW = CARD_W + (count - 1) * STEP + 10;
  const containerH = CARD_H + 30;

  container.style.width    = containerW + "px";
  container.style.height   = containerH + "px";
  container.style.position = "relative";

  // Hráč:  střed kružnice RADIUS px POD kontejnerem, oblouk nahoru
  //         rotace kolem spodního středu karty, angleDeg kladný = doprava
  // Soupeř: střed kružnice RADIUS px NAD kontejnerem, oblouk dolů
  //         rotace kolem horního středu karty, angleDeg záporný = zrcadlení
  const cx = containerW / 2;
  const cy = fanDown ? -RADIUS : containerH + RADIUS;

  cards.forEach((card, i) => {
    const isSelected = selectedCard
      && selectedCard.playerIndex === player.index
      && selectedCard.cardId === card.id;

    const el = createCardElement(card, clickable, isSelected);

    const angleDeg = startAngle + i * SPREAD;
    const angleRad = angleDeg * Math.PI / 180;

    let left, top, origin, transform;

    if (fanDown) {
      // Horní střed karty leží na kružnici nad kontejnerem
      const tx = cx + RADIUS * Math.sin(angleRad);
      const ty = cy + RADIUS * Math.cos(angleRad);
      left      = tx - CARD_W / 2;
      top       = ty;
      origin    = `${CARD_W / 2}px 0px`;
      transform = `rotate(${-angleDeg}deg)`;  // záporný = oblouk dolů (přirozený pro soupeře)
    } else {
      // Spodní střed karty leží na kružnici pod kontejnerem
      const bx = cx + RADIUS * Math.sin(angleRad);
      const by = cy - RADIUS * Math.cos(angleRad);
      left      = bx - CARD_W / 2;
      top       = by - CARD_H;
      origin    = `${CARD_W / 2}px ${CARD_H}px`;
      transform = `rotate(${angleDeg}deg)`;
    }

    el.style.position        = "absolute";
    el.style.left            = left + "px";
    el.style.top             = top  + "px";
    el.style.zIndex          = i + 1;
    el.style.transformOrigin = origin;
    el.style.transform       = transform;

    if (isSelected) {
      el.style.transform = `translateY(-22px) rotate(${angleDeg}deg)`;
      el.style.zIndex    = 99;
    }

    if (clickable && !isSelected) {
      el.addEventListener("mouseenter", () => {
        el.style.transform = `translateY(-16px) rotate(${angleDeg}deg)`;
        el.style.zIndex    = 99;
      });
      el.addEventListener("mouseleave", () => {
        el.style.transform = transform;
        el.style.zIndex    = i + 1;
      });
    }

    if (clickable) {
      el.addEventListener("click", () => onCardClick(player.index, card.id));
    }

    container.appendChild(el);
  });
}

/** Vykreslí odhazovací balíček – zobrazí poslední 3 karty překrývající se. */
function renderDiscardPile() {
  const wrapper = document.getElementById("discard-pile-cards");
  const countEl = document.getElementById("discard-count");
  if (!wrapper) return;

  wrapper.innerHTML = "";
  const pile = gameState.discardPile;
  const show = pile.slice(-3);

  show.forEach((card, i) => {
    const el = createCardElement(card, true);

    // Náklon odvozený z id karty → deterministický, "náhodně vypadá"
    // Rozsah -20° až +20° – větší náklon by karty vysouvalo mimo slot
    const rotation = ((card.id * 37 + 13) % 41) - 20;

    el.style.transform = `rotate(${rotation}deg)`;
    el.style.zIndex    = i + 1; // +1 aby překryl border kontejneru

    wrapper.appendChild(el);
  });

  if (countEl) countEl.textContent = T().cardsLeft(pile.length);
}

/** Aktualizuje počet karet v dobíracím balíčku. */
function renderDrawPile() {
  const countEl = document.getElementById("draw-count");
  if (countEl) countEl.textContent = T().cardsLeft(gameState.drawPile.length);
}

/** Aktualizuje turn indicator nahoře. */
function renderTurnIndicator() {
  const el = document.getElementById("turn-indicator");
  if (!el) return;
  const player = currentPlayer();
  el.textContent = player.isHuman ? T().yourTurn : T().aiThinking;
}

/** Hlavní render – zavolá vše. */
function renderAll() {
  const human    = gameState.players[0];
  const opponent = gameState.players[1];

  // Popisky
  const labelPlayer   = document.getElementById("label-player");
  const labelOpponent = document.getElementById("label-opponent");
  if (labelPlayer)   labelPlayer.textContent   = human.name;
  if (labelOpponent) labelOpponent.textContent = opponent.name;

  // Ruce
  renderHand(human,    "hand-player",   true);   // hráč vidí své karty
  renderHand(opponent, "hand-opponent", false, true);  // soupeř – vějíř dolů

  // Balíčky
  renderDiscardPile();
  renderDrawPile();

  // Turn indicator
  renderTurnIndicator();

  // Highlight klikatelných cílů podle toho zda je vybrána karta
  // Listenery jsou registrovány jednou v initListeners(), ne zde
  const discardEl = document.getElementById("discard-pile");
  if (discardEl) {
    discardEl.classList.toggle("target-highlight", selectedCard !== null);
  }
}


// ── Inicializace listenerů (jednou při startu) ─────────────────────────────

/**
 * Všechny statické klikatelné cíle dostávají listener právě jednou.
 * Dynamické cíle (karty v ruce) se přidávají v renderHand při každém renderu
 * – to je v pořádku, protože renderHand vždy smaže a znovu vytvoří elementy.
 *
 * Proč ne v renderAll?
 *   renderAll se volá po každém tahu. Kdybychom listener přidávali tam,
 *   každý render by přidal další kopii → po 10 tazích by jeden klik
 *   spustil onDiscardClick 10×. Clone hack tento problém obcházel ale
 *   způsoboval jiné problémy (ztráta potomků, race conditions).
 */
function initListeners() {
  document.getElementById("discard-pile")
    .addEventListener("click", onDiscardClick);
}


// ── Spuštění ───────────────────────────────────────────────────────────────

initListeners();
initGame(2);
