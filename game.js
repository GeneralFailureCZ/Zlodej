/**
 * ZLODĚJ – Card Game
 * game.js – Vlákno 5: Vykládání karet na bodovací balíček + závazek
 */

// ── 1. Lokalizace ──────────────────────────────────────────────────────────

const LANG = {
  en: {
    playerName:    "Player",
    aiName:        "Computer",
    draw:          "Draw",
    discard:       "Discard",
    scorePile:     "Score",
    joker:         "Joker",
    yourTurn:      "Your turn — select a card",
    selectTarget:  "Now choose where to play it",
    aiThinking:    "Computer is thinking…",
    discarded:     (name, card) => `${name} discarded ${card}.`,
    newRound:      (n) => `Round ${n} — cards dealt.`,
    commitStart:   (name, card) => `${name} started commitment with ${card}.`,
    commitDone:    (name, card) => `${name} completed pair with ${card}.`,
    commitBlocked: (rank) => `Complete your commitment — play a ${rank}.`,
    noPair:        (card) => `No pair for ${card} in hand.`,
  },
  cs: {
    playerName:    "Hráč",
    aiName:        "Počítač",
    draw:          "Dobírací",
    discard:       "Odhoz",
    scorePile:     "Body",
    joker:         "Žolík",
    yourTurn:      "Tvůj tah — vyber kartu",
    selectTarget:  "Vyber kam kartu zahraješ",
    aiThinking:    "Počítač přemýšlí…",
    discarded:     (name, card) => `${name} odhodil ${card}.`,
    newRound:      (n) => `Kolo ${n} — rozdány karty.`,
    commitStart:   (name, card) => `${name} začal závazek kartou ${card}.`,
    commitDone:    (name, card) => `${name} dokončil pár kartou ${card}.`,
    commitBlocked: (rank) => `Musíš dokončit závazek — zahraj ${rank}.`,
    noPair:        (card) => `V ruce není pár pro ${card}.`,
  }
};

let currentLang = "en";
const T = () => LANG[currentLang];


// ── 2. Konfigurace ─────────────────────────────────────────────────────────

const CONFIG = {
  HAND_SIZE:        6,
  DECKS:            2,
  JOKERS_PER_DECK:  2,
  ANIMATION_SPEED:  "normal",
  AI_DELAY_MS:      900,
};

const SUITS     = ["♠", "♥", "♦", "♣"];
const RANKS     = ["2","3","4","5","6","7","8","9","10","J","Q","K","A","Joker"];
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

let gameState    = null;
let selectedCard = null;   // { playerIndex, cardId } nebo null


// ── 5. Hráč ───────────────────────────────────────────────────────────────

function createPlayer(index, isHuman) {
  return {
    index,
    isHuman,
    name:         isHuman ? T().playerName : T().aiName,
    hand:         [],
    // scorePile = pole skupin, každá skupina = pole karet
    // př. [ [K♠, K♥], [7♦, 7♣] ]
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
  const deck    = shuffle(createDeck());
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
    subTurnIndex:       0,
    phase:              "init",
    seriesScores:       players.map(() => 0),
  };

  console.log(`🎲 First player: ${players[firstPlayer].name} (index ${firstPlayer})`);

  dealCards();
  setStatus(T().newRound(1));
  renderAll();

  if (!currentPlayer().isHuman) scheduleAiTurn();
}


// ── 8. Pomocné funkce ──────────────────────────────────────────────────────

function currentPlayer() {
  return gameState.players[gameState.currentPlayerIndex];
}

function findCardInHand(playerIndex, cardId) {
  const hand = gameState.players[playerIndex].hand;
  const idx  = hand.findIndex(c => c.id === cardId);
  if (idx === -1) return null;
  return { card: hand[idx], index: idx };
}

function cardLabel(card) {
  return card.rank === "Joker" ? T().joker : `${card.rank}${card.suit}`;
}

function setStatus(text, highlight = false) {
  const el = document.getElementById("status-log");
  if (!el) return;
  el.textContent = text;
  if (highlight) {
    el.classList.add("highlight");
    setTimeout(() => el.classList.remove("highlight"), 1200);
  }
}

function calcScore(player) {
  return player.scorePile.reduce(
    (total, group) => total + group.reduce((s, card) => s + card.value, 0),
    0
  );
}


// ── 9. Akce: odhoz karty ──────────────────────────────────────────────────

function discardCard(playerIndex, cardId) {
  const player = gameState.players[playerIndex];

  if (player.inCommitment) {
    const neededRank = player.scorePile[player.scorePile.length - 1][0].rank;
    setStatus(T().commitBlocked(neededRank));
    return false;
  }

  const found = findCardInHand(playerIndex, cardId);
  if (!found) return false;

  const { card, index } = found;
  player.hand.splice(index, 1);
  gameState.discardPile.push(card);

  setStatus(T().discarded(player.name, cardLabel(card)), true);
  return true;
}


// ── 10. Akce: vyložení na bodovací balíček ────────────────────────────────

/**
 * playToScorePile() – viz komentář v předchozím vlákně.
 *
 * Případ B (inCommitment = true): dokládá druhou kartu.
 *   – zkontroluje rank, přidá do poslední skupiny, zavře závazek.
 *
 * Případ A (inCommitment = false): začíná závazek.
 *   – zkontroluje pár v ruce, vytvoří novou skupinu s jednou kartou.
 */
function playToScorePile(playerIndex, cardId) {
  const player = gameState.players[playerIndex];
  const found  = findCardInHand(playerIndex, cardId);
  if (!found) return false;

  const { card, index } = found;

  // Případ B: dokládáme druhou kartu
  if (player.inCommitment) {
    const lastGroup  = player.scorePile[player.scorePile.length - 1];
    const neededRank = lastGroup[0].rank;

    if (card.rank !== neededRank) {
      setStatus(T().commitBlocked(neededRank));
      return false;
    }

    player.hand.splice(index, 1);
    lastGroup.push(card);
    player.inCommitment = false;
    player.totalScore   = calcScore(player);

    setStatus(T().commitDone(player.name, cardLabel(card)), true);
    return true;
  }

  // Případ A: nový závazek
  const hasPair = player.hand.some((c, i) => i !== index && c.rank === card.rank);
  if (!hasPair) {
    setStatus(T().noPair(cardLabel(card)));
    return false;
  }

  player.hand.splice(index, 1);
  player.scorePile.push([card]);
  player.inCommitment = true;
  player.totalScore   = calcScore(player);

  setStatus(T().commitStart(player.name, cardLabel(card)), true);
  return true;
}


// ── 11. Posun tahu ─────────────────────────────────────────────────────────

function advanceTurn() {
  selectedCard = null;

  const numPlayers    = gameState.players.length;
  const totalSubTurns = numPlayers * CONFIG.HAND_SIZE;

  gameState.subTurnIndex++;
  gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % numPlayers;

  if (gameState.subTurnIndex >= totalSubTurns) {
    gameState.subTurnIndex = 0;
    gameState.currentRound++;

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

  if (!currentPlayer().isHuman) {
    scheduleAiTurn();
  } else {
    if (currentPlayer().inCommitment) {
      const neededRank = currentPlayer().scorePile[currentPlayer().scorePile.length - 1][0].rank;
      setStatus(T().commitBlocked(neededRank));
    } else {
      setStatus(T().yourTurn);
    }
  }
}


// ── 12. AI tah ─────────────────────────────────────────────────────────────

function scheduleAiTurn() {
  setStatus(T().aiThinking);
  setTimeout(() => {
    const ai = currentPlayer();
    if (ai.hand.length === 0) return;

    if (ai.inCommitment) {
      const neededRank = ai.scorePile[ai.scorePile.length - 1][0].rank;
      const matchCard  = ai.hand.find(c => c.rank === neededRank);
      if (matchCard) {
        playToScorePile(ai.index, matchCard.id);
        advanceTurn();
        return;
      }
    }

    const randomIndex = Math.floor(Math.random() * ai.hand.length);
    discardCard(ai.index, ai.hand[randomIndex].id);
    advanceTurn();
  }, CONFIG.AI_DELAY_MS);
}


// ── 13. Systém dvou kliků ─────────────────────────────────────────────────

function onCardClick(playerIndex, cardId) {
  if (gameState.phase !== "playing") return;
  if (!currentPlayer().isHuman) return;
  if (playerIndex !== gameState.currentPlayerIndex) return;

  if (selectedCard && selectedCard.cardId === cardId) {
    selectedCard = null;
    if (currentPlayer().inCommitment) {
      const rank = currentPlayer().scorePile[currentPlayer().scorePile.length - 1][0].rank;
      setStatus(T().commitBlocked(rank));
    } else {
      setStatus(T().yourTurn);
    }
  } else {
    selectedCard = { playerIndex, cardId };
    setStatus(T().selectTarget);
  }

  renderHand(gameState.players[0], "hand-player", true);
}

function onDiscardClick() {
  if (!selectedCard || gameState.phase !== "playing" || !currentPlayer().isHuman) return;
  resolveAction("discard");
}

function onScorePileClick(playerIndex) {
  if (!selectedCard || gameState.phase !== "playing" || !currentPlayer().isHuman) return;
  if (playerIndex !== gameState.currentPlayerIndex) return;
  resolveAction("score-self");
}

function resolveAction(targetType) {
  if (!selectedCard) return;

  if (targetType === "discard") {
    const ok = discardCard(selectedCard.playerIndex, selectedCard.cardId);
    if (ok) advanceTurn();
    return;
  }

  if (targetType === "score-self") {
    const ok = playToScorePile(selectedCard.playerIndex, selectedCard.cardId);
    if (ok) advanceTurn();
    return;
  }

  console.log("Target type not yet implemented:", targetType);
}


// ── 14. Renderování ────────────────────────────────────────────────────────

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

function renderHand(player, containerId, clickable = false, fanDown = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const cards = player.hand;
  const count = cards.length;
  if (count === 0) return;

  const CARD_W  = 125;
  const CARD_H  = 180;
  const SPREAD  = 5;
  const RADIUS  = 600;
  const STEP    = CARD_W * 0.18;

  const totalAngle = SPREAD * (count - 1);
  const startAngle = -totalAngle / 2;

  const containerW = CARD_W + (count - 1) * STEP + 10;
  const containerH = CARD_H + 30;

  container.style.width    = containerW + "px";
  container.style.height   = containerH + "px";
  container.style.position = "relative";

  const cx = containerW / 2;
  const cy = fanDown ? -RADIUS : containerH + RADIUS;

  cards.forEach((card, i) => {
    const isSelected = selectedCard
      && selectedCard.playerIndex === player.index
      && selectedCard.cardId === card.id;

    const el       = createCardElement(card, clickable, isSelected);
    const angleDeg = startAngle + i * SPREAD;
    const angleRad = angleDeg * Math.PI / 180;

    let left, top, origin, transform;

    if (fanDown) {
      const tx = cx + RADIUS * Math.sin(angleRad);
      const ty = cy + RADIUS * Math.cos(angleRad);
      left      = tx - CARD_W / 2;
      top       = ty;
      origin    = `${CARD_W / 2}px 0px`;
      transform = `rotate(${-angleDeg}deg)`;
    } else {
      const bx = cx + RADIUS * Math.sin(angleRad);
      const by = cy - RADIUS * Math.cos(angleRad);
      left      = bx - CARD_W / 2;
      top       = by - CARD_H;
      origin    = `${CARD_W / 2}px ${CARD_H}px`;
      transform = `rotate(${angleDeg}deg)`;
    }

    el.style.position        = "absolute";
    el.style.left            = left + "px";
    el.style.top             = top + "px";
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

function renderDiscardPile() {
  const wrapper = document.getElementById("discard-pile-cards");
  const countEl = document.getElementById("discard-count");
  if (!wrapper) return;

  wrapper.innerHTML = "";
  const pile = gameState.discardPile;
  const show = pile.slice(-3);

  show.forEach((card, i) => {
    const el       = createCardElement(card, true);
    const rotation = ((card.id * 37 + 13) % 41) - 20;
    el.style.transform = `rotate(${rotation}deg)`;
    el.style.zIndex    = i + 1;
    wrapper.appendChild(el);
  });

  // Jen číslo
  if (countEl) countEl.textContent = pile.length;
}

function renderDrawPile() {
  const countEl = document.getElementById("draw-count");
  // Jen číslo
  if (countEl) countEl.textContent = gameState.drawPile.length;
}

/**
 * renderScorePile() – vykreslí bodovací balíček hráče.
 *
 * Klíčová změna oproti předchozí verzi:
 *   Každá .score-group je position:absolute, top:0, left:0
 *   → všechny skupiny leží na stejném místě ve slotu, překryté jako skutečný balíček.
 *
 * Zobrazujeme VŠECHNY skupiny (ne jen poslední 2), ale spodní skupiny
 * jsou překryté těmi vrchními — stejně jako fyzický balíček karet.
 * z-index roste s indexem skupiny → vrchní skupina je vidět nahoře.
 *
 * Otočení:
 *   - Závazek (skupina s 1 kartou) → 45°
 *   - Dokončená skupina → sudý absoluteIndex = 0°, lichý = 90°
 *
 * Počítadlo skupin: jen číslo v .score-pile-count pod slotem.
 */
function renderScorePile(player, slotId, countId, scoreId) {
  const slot = document.getElementById(slotId);
  if (!slot) return;
  slot.innerHTML = "";

  const pile = player.scorePile;

  if (pile.length === 0) {
    slot.innerHTML = `<span class="empty-label">empty</span>`;
  } else {
    pile.forEach((group, absoluteIndex) => {
      const isCommitment = group.length === 1;

      let rotation;
      if (isCommitment) {
        rotation = 45;
      } else {
        rotation = absoluteIndex % 2 === 0 ? 0 : 90;
      }

      // Wrapper pro skupinu — leží přesně na místě slotu
      const wrapper = document.createElement("div");
      wrapper.classList.add("score-group");
      if (isCommitment) wrapper.classList.add("commitment");
      wrapper.style.transform = `rotate(${rotation}deg)`;
      wrapper.style.zIndex    = absoluteIndex + 1;  // vrchní skupina = nejvyšší z-index

      // Karty ve skupině — malý offset aby bylo vidět že je jich víc
      group.forEach((card, cardIndex) => {
        const el = createCardElement(card, true);
        el.style.position = "absolute";
        el.style.top      = (cardIndex * 5) + "px";
        el.style.left     = (cardIndex * 3) + "px";
        el.style.zIndex   = cardIndex + 1;
        wrapper.appendChild(el);
      });

      slot.appendChild(wrapper);
    });
  }

  // Počítadlo skupin — jen číslo
  const countEl = document.getElementById(countId);
  if (countEl) countEl.textContent = pile.length > 0 ? pile.length : "";

  // Skóre
  const scoreEl = document.getElementById(scoreId);
  if (scoreEl) scoreEl.textContent = calcScore(player);
}

function renderTurnIndicator() {
  const el = document.getElementById("turn-indicator");
  if (!el) return;
  el.textContent = currentPlayer().isHuman ? T().yourTurn : T().aiThinking;
}

function renderAll() {
  const human    = gameState.players[0];
  const opponent = gameState.players[1];

  const labelPlayer   = document.getElementById("label-player");
  const labelOpponent = document.getElementById("label-opponent");
  if (labelPlayer)   labelPlayer.textContent   = human.name;
  if (labelOpponent) labelOpponent.textContent = opponent.name;

  renderHand(human,    "hand-player",   true);
  renderHand(opponent, "hand-opponent", false, true);

  renderScorePile(human,    "score-pile-player",   "score-count-player",   "score-player");
  renderScorePile(opponent, "score-pile-opponent", "score-count-opponent", "score-opponent");

  renderDiscardPile();
  renderDrawPile();
  renderTurnIndicator();

  // Zvýrazni cíle pokud je vybrána karta
  document.getElementById("discard-pile")
    .classList.toggle("target-highlight", selectedCard !== null);
  document.getElementById("score-pile-player")
    .classList.toggle("target-highlight", selectedCard !== null);
}


// ── Inicializace listenerů ─────────────────────────────────────────────────

function initListeners() {
  document.getElementById("discard-pile")
    .addEventListener("click", onDiscardClick);

  document.getElementById("score-pile-player")
    .addEventListener("click", () => onScorePileClick(0));

  document.getElementById("score-pile-opponent")
    .addEventListener("click", () => {
      // placeholder pro vlákno 6: krádež
    });
}


// ── Spuštění ───────────────────────────────────────────────────────────────

initListeners();
initGame(2);
