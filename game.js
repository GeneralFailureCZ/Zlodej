/**
 * ZLODĚJ – Card Game
 * game.js – Vlákno 11: Nový layout, vějíře, score pile fixovaný
 */

// ── 1. Lokalizace ──────────────────────────────────────────────────────────

const LANG = {
  en: {
    playerName:       "Player",
    aiName:           "Computer",
    joker:            "Joker",
    yourTurn:         "Your turn — select a card",
    selectTarget:     "Now choose where to play it",
    aiThinking:       "Computer is thinking…",
    discarded:        (name, card) => `${name} discarded ${card}.`,
    newRound:         (n) => `Round ${n} — cards dealt.`,
    commitStart:      (name, card) => `${name} started commitment with ${card}.`,
    commitDone:       (name, card) => `${name} completed pair with ${card}.`,
    commitBlocked:    (rank) => `Complete your commitment — play a ${rank}.`,
    noPair:           (card) => `No pair for ${card} in hand.`,
    tookFromDiscard:  (name, card) => `${name} took from discard with ${card}.`,
    stolen:           (name, card) => `${name} stole with ${card}.`,
    cantSteal:        "Cannot steal — opponent is in commitment.",
    cantStealEmpty:   "Nothing to steal.",
    cantStealRank:    "Card rank doesn't match the top group.",
    addedToGroup:     (name, card) => `${name} added ${card} to their group.`,
    gameOver:         "Game over!",
    gameOverStalemate:"Game over — no progress for two rounds.",
    gameOverTitle:    "Game Over",
    seriesOverTitle:  "Series Over",
    game:             (n) => `Game ${n}`,
    total:            "Total",
    nextGame:         "Next game",
    newSeries:        "New series",
    winner:           (name) => `${name} wins!`,
  },
  cs: {
    playerName:       "Hráč",
    aiName:           "Počítač",
    joker:            "Žolík",
    yourTurn:         "Tvůj tah — vyber kartu",
    selectTarget:     "Vyber kam kartu zahraješ",
    aiThinking:       "Počítač přemýšlí…",
    discarded:        (name, card) => `${name} odhodil ${card}.`,
    newRound:         (n) => `Kolo ${n} — rozdány karty.`,
    commitStart:      (name, card) => `${name} začal závazek kartou ${card}.`,
    commitDone:       (name, card) => `${name} dokončil pár kartou ${card}.`,
    commitBlocked:    (rank) => `Musíš dokončit závazek — zahraj ${rank}.`,
    noPair:           (card) => `V ruce není pár pro ${card}.`,
    tookFromDiscard:  (name, card) => `${name} dobral z odhazu kartou ${card}.`,
    stolen:           (name, card) => `${name} ukradl kartou ${card}.`,
    cantSteal:        "Nelze krást — soupeř je v závazku.",
    cantStealEmpty:   "Není co krást.",
    cantStealRank:    "Rank karty nesedí na vrchní skupinu.",
    addedToGroup:     (name, card) => `${name} přiložil ${card} ke skupině.`,
    gameOver:         "Konec hry!",
    gameOverStalemate:"Konec hry — dvě kola bez pohybu.",
    gameOverTitle:    "Konec hry",
    seriesOverTitle:  "Konec série",
    game:             (n) => `Hra ${n}`,
    total:            "Celkem",
    nextGame:         "Další hra",
    newSeries:        "Nová série",
    winner:           (name) => `Vyhrál ${name}!`,
  }
};

let currentLang = "en";
const T = () => LANG[currentLang];


// ── 2. Konfigurace ─────────────────────────────────────────────────────────

const CONFIG = {
  HAND_SIZE:             6,
  DECKS:                 2,
  JOKERS_PER_DECK:       2,
  ANIMATION_SPEED:       "normal",
  AI_DELAY_MS:           900,
  AI_LEVEL:              3,
  AI_OPTIMAL_CHANCE:     0.65,
  STALEMATE_ROUNDS:      2,
  STALEMATE_MAX_CARDS:   20,
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
let selectedCard = null;
let pendingPopupAction  = null;
let pendingDiscardPopup = null;

let seriesState = null;


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
  const players    = gameState.players;
  const numPlayers = players.length;

  gameState.scoresBefore = players.map(p => p.totalScore);

  function drawOne() {
    if (gameState.drawPile.length > 0)    return gameState.drawPile.pop();
    if (gameState.discardPile.length > 0) return gameState.discardPile.shift();
    return null;
  }

  const totalCards = gameState.drawPile.length + gameState.discardPile.length;
  if (totalCards < numPlayers) {
    endGame("empty");
    return;
  }

  let dealtPerPlayer = 0;
  for (let round = 0; round < CONFIG.HAND_SIZE; round++) {
    const available = gameState.drawPile.length + gameState.discardPile.length;
    if (available < numPlayers) break;

    for (let i = 0; i < numPlayers; i++) {
      const card = drawOne();
      if (!card) break;
      players[i].hand.push(card);
    }
    dealtPerPlayer++;
  }

  gameState.currentHandSize = dealtPerPlayer;
  gameState.phase           = "playing";
}


// ── 7. Detekce stagnace, skip tlačítko, konec hry ─────────────────────────

function updateSkipButton() {
  const skipBtn = document.getElementById("skip-btn");
  if (!skipBtn || !gameState) return;

  const cardsInHands = gameState.players.reduce((s, p) => s + p.hand.length, 0);
  const totalCards   = gameState.drawPile.length + gameState.discardPile.length + cardsInHands;

  const show = gameState.drawPile.length === 0
            && totalCards < CONFIG.STALEMATE_MAX_CARDS
            && gameState.phase === "playing";

  skipBtn.classList.toggle("hidden", !show);
}

function checkStalemate() {
  const totalCards = gameState.drawPile.length + gameState.discardPile.length;

  if (totalCards > CONFIG.STALEMATE_MAX_CARDS) {
    gameState.stalemateCount = 0;
    return false;
  }

  const scoresAfter   = gameState.players.map(p => p.totalScore);
  const someoneScored = scoresAfter.some((s, i) => s !== gameState.scoresBefore[i]);

  if (someoneScored) {
    gameState.stalemateCount = 0;
    return false;
  }

  gameState.stalemateCount++;

  if (gameState.stalemateCount >= CONFIG.STALEMATE_ROUNDS) {
    endGame("stalemate");
    return true;
  }

  return false;
}

function endGame(reason) {
  gameState.phase = "gameEnd";
  const msg = reason === "stalemate" ? T().gameOverStalemate : T().gameOver;
  setStatus(msg, true);
  updateSkipButton();

  if (seriesState) {
    const gameIndex = seriesState.gamesPlayed;
    gameState.players.forEach((p, i) => {
      seriesState.scores[i][gameIndex] = p.totalScore;
    });
    seriesState.gamesPlayed++;
  }

  renderAll();
  setTimeout(() => showEndOverlay(), 600);
}


// ── 8. Série a end overlay ─────────────────────────────────────────────────

function initSeries(numPlayers) {
  seriesState = {
    numPlayers,
    gamesInSeries: numPlayers,
    gamesPlayed:   0,
    scores:        Array.from({ length: numPlayers }, () => []),
    firstPlayer:   Math.floor(Math.random() * numPlayers),
  };
}

function showEndOverlay() {
  const overlay = document.getElementById("end-overlay");
  const title   = document.getElementById("end-title");
  const results = document.getElementById("end-results");
  const btn     = document.getElementById("end-btn");

  const isSeriesEnd = seriesState.gamesPlayed >= seriesState.gamesInSeries;

  title.textContent = isSeriesEnd ? T().seriesOverTitle : T().gameOverTitle;
  btn.textContent   = isSeriesEnd ? T().newSeries       : T().nextGame;
  results.innerHTML = "";

  if (!isSeriesEnd) {
    const gamePts  = gameState.players.map(p => p.totalScore);
    const maxScore = Math.max(...gamePts);

    gameState.players.forEach((p, i) => {
      const row = document.createElement("div");
      row.classList.add("result-row");
      if (gamePts[i] === maxScore) row.classList.add("result-winner");
      row.innerHTML = `
        <span class="result-name">${p.name}</span>
        <span class="result-pts">${gamePts[i]} pts</span>
      `;
      results.appendChild(row);
    });
  } else {
    for (let g = 0; g < seriesState.gamesPlayed; g++) {
      const label = document.createElement("div");
      label.classList.add("result-divider");
      label.textContent = T().game(g + 1);
      results.appendChild(label);

      const gScores = seriesState.scores.map(s => s[g] || 0);
      const maxG    = Math.max(...gScores);

      gameState.players.forEach((p, i) => {
        const row = document.createElement("div");
        row.classList.add("result-row");
        if (gScores[i] === maxG) row.classList.add("result-winner");
        row.innerHTML = `
          <span class="result-name">${p.name}</span>
          <span class="result-pts">${gScores[i]} pts</span>
        `;
        results.appendChild(row);
      });
    }

    const totalLabel = document.createElement("div");
    totalLabel.classList.add("result-divider");
    totalLabel.textContent = T().total;
    results.appendChild(totalLabel);

    const totals   = gameState.players.map((p, i) =>
      seriesState.scores[i].reduce((s, v) => s + v, 0)
    );
    const maxTotal = Math.max(...totals);

    gameState.players.forEach((p, i) => {
      const row = document.createElement("div");
      row.classList.add("result-row", "result-total");
      if (totals[i] === maxTotal) row.classList.add("result-winner");
      row.innerHTML = `
        <span class="result-name">${p.name}</span>
        <span class="result-pts">${totals[i]} pts</span>
      `;
      results.appendChild(row);
    });
  }

  overlay.classList.remove("hidden");

  btn.onclick = () => {
    overlay.classList.add("hidden");
    if (isSeriesEnd) {
      initSeries(seriesState.numPlayers);
      startGame(seriesState.numPlayers, 0);
    } else {
      const nextFirst = seriesState.gamesPlayed % seriesState.numPlayers;
      startGame(seriesState.numPlayers, nextFirst);
    }
  };
}


// ── 9. Inicializace ────────────────────────────────────────────────────────

function startGame(numPlayers, firstPlayerIndex) {
  const deck    = shuffle(createDeck());
  const players = [];
  for (let i = 0; i < numPlayers; i++)
    players.push(createPlayer(i, i === 0));

  gameState = {
    players,
    drawPile:           deck,
    discardPile:        [],
    currentPlayerIndex: firstPlayerIndex,
    currentRound:       1,
    subTurnIndex:       0,
    currentHandSize:    CONFIG.HAND_SIZE,
    phase:              "init",
    stalemateCount:     0,
    scoresBefore:       players.map(() => 0),
    eventLog:           [],
  };

  selectedCard        = null;
  pendingPopupAction  = null;
  pendingDiscardPopup = null;

  hideActionPopup();
  hideDiscardPopup();

  dealCards();
  setStatus(T().newRound(1));
  renderAll();
  updateSkipButton();

  if (!currentPlayer().isHuman) scheduleAiTurn();
}

function initGame(numPlayers = 2) {
  initSeries(numPlayers);
  startGame(numPlayers, seriesState.firstPlayer);
}


// ── 10. Pomocné funkce ─────────────────────────────────────────────────────

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
  if (gameState) {
    const log = gameState.eventLog;
    if (log.length === 0 || log[log.length - 1] !== text) {
      log.push(text);
    }
  }

  const el = document.getElementById("status-log");
  if (!el) return;
  el.textContent = text;
  if (highlight) {
    el.classList.add("highlight");
    setTimeout(() => el.classList.remove("highlight"), 1200);
  }

  renderEventLog();
}

function calcScore(player) {
  return player.scorePile.reduce(
    (total, group) => total + group.reduce((s, card) => s + card.value, 0),
    0
  );
}


// ── 11. Event log ──────────────────────────────────────────────────────────

function renderEventLog() {
  const list = document.getElementById("event-list");
  if (!list || !gameState) return;

  list.innerHTML = "";

  const log    = gameState.eventLog;
  const toShow = log.slice(0, -1);

  toShow.forEach(msg => {
    const li = document.createElement("li");
    li.textContent = msg;
    list.appendChild(li);
  });

  const expanded = document.getElementById("status-log-expanded");
  if (expanded && !expanded.classList.contains("hidden")) {
    expanded.scrollTop = expanded.scrollHeight;
  }
}

function initStatusLogToggle() {
  const statusLog = document.getElementById("status-log");
  const expanded  = document.getElementById("status-log-expanded");

  statusLog.addEventListener("click", (e) => {
    e.stopPropagation();
    expanded.classList.toggle("hidden");
    if (!expanded.classList.contains("hidden")) {
      renderEventLog();
      expanded.scrollTop = expanded.scrollHeight;
    }
  });

  document.addEventListener("click", () => {
    if (!expanded.classList.contains("hidden")) {
      expanded.classList.add("hidden");
    }
  });

  expanded.addEventListener("click", (e) => e.stopPropagation());
}


// ── 12. Algoritmus rozdělení karet do skupin ──────────────────────────────

function splitIntoGroups(cards) {
  const jokers  = cards.filter(c => c.rank === "Joker");
  const normals = cards.filter(c => c.rank !== "Joker");

  const groups = [];
  let i = 0;

  if (normals.length % 2 !== 0) {
    if (jokers.length > 0) {
      groups.push([jokers.shift(), normals[0]]);
      i = 1;
    } else {
      groups.push(normals.slice(0, 3));
      i = 3;
    }
  }

  while (i < normals.length) {
    groups.push(normals.slice(i, i + 2));
    i += 2;
  }

  if (groups.length === 0 && jokers.length > 0) {
    groups.push([]);
  }

  jokers.forEach((joker, idx) => {
    if (idx < groups.length) groups[idx].unshift(joker);
  });

  return groups;
}


// ── 13. Akce: krádež ─────────────────────────────────────────────────────

function stealFromScorePile(thiefIndex, cardId, victimIndex) {
  const thief  = gameState.players[thiefIndex];
  const victim = gameState.players[victimIndex];

  if (thief.inCommitment) {
    setStatus(T().commitBlocked(thief.scorePile[thief.scorePile.length - 1][0].rank));
    return false;
  }
  if (victim.scorePile.length === 0) { setStatus(T().cantStealEmpty); return false; }
  if (victim.inCommitment)           { setStatus(T().cantSteal);      return false; }

  const found = findCardInHand(thiefIndex, cardId);
  if (!found) return false;

  const { card: thiefCard, index: thiefIdx2 } = found;
  const stolenGroup = victim.scorePile[victim.scorePile.length - 1];

  const thiefIsJoker = thiefCard.rank === "Joker";
  const stolenRank   = stolenGroup.find(c => c.rank !== "Joker")?.rank;

  if (!thiefIsJoker && thiefCard.rank !== stolenRank) { setStatus(T().cantStealRank); return false; }
  if (thiefIsJoker && stolenGroup.every(c => c.rank === "Joker")) { setStatus(T().cantStealRank); return false; }

  thief.hand.splice(thiefIdx2, 1);
  victim.scorePile.pop();
  victim.totalScore = calcScore(victim);

  const stealRank = thiefIsJoker ? stolenRank : thiefCard.rank;
  let ownGroup = [];
  if (thief.scorePile.length > 0) {
    const topGroup = thief.scorePile[thief.scorePile.length - 1];
    if (topGroup.find(c => c.rank !== "Joker")?.rank === stealRank) {
      ownGroup = thief.scorePile.pop();
    }
  }

  splitIntoGroups([thiefCard, ...stolenGroup, ...ownGroup])
    .forEach(g => thief.scorePile.push(g));
  thief.totalScore = calcScore(thief);

  setStatus(T().stolen(thief.name, cardLabel(thiefCard)), true);
  return true;
}


// ── 14. Akce: odhoz ─────────────────────────────────────────────────────

function discardCard(playerIndex, cardId) {
  const player = gameState.players[playerIndex];

  if (player.inCommitment) {
    setStatus(T().commitBlocked(player.scorePile[player.scorePile.length - 1][0].rank));
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


// ── 15. Akce: vzít z odhazu ──────────────────────────────────────────────

function takeFromDiscard(playerIndex, cardId) {
  const player = gameState.players[playerIndex];

  if (player.inCommitment) {
    setStatus(T().commitBlocked(player.scorePile[player.scorePile.length - 1][0].rank));
    return false;
  }

  const found = findCardInHand(playerIndex, cardId);
  if (!found) return false;

  const { card, index } = found;

  if (gameState.discardPile.length === 0) return false;

  const topCard   = gameState.discardPile[gameState.discardPile.length - 1];
  const handJoker = card.rank === "Joker";
  const topJoker  = topCard.rank === "Joker";

  const group = handJoker ? [card, topCard]
              : topJoker  ? [topCard, card]
              :              [card, topCard];

  player.hand.splice(index, 1);
  gameState.discardPile.pop();
  player.scorePile.push(group);
  player.totalScore = calcScore(player);

  setStatus(T().tookFromDiscard(player.name, cardLabel(card)), true);
  return true;
}


// ── 16. Akce: vyložení na score pile ─────────────────────────────────────

function playToScorePile(playerIndex, cardId, forceNew = false) {
  const player = gameState.players[playerIndex];
  const found  = findCardInHand(playerIndex, cardId);
  if (!found) return false;

  const { card, index } = found;

  if (player.inCommitment) {
    const lastGroup  = player.scorePile[player.scorePile.length - 1];
    const neededRank = lastGroup[0].rank;
    if (card.rank !== neededRank) { setStatus(T().commitBlocked(neededRank)); return false; }

    player.hand.splice(index, 1);
    lastGroup.push(card);
    player.inCommitment = false;
    player.totalScore   = calcScore(player);
    setStatus(T().commitDone(player.name, cardLabel(card)), true);
    return true;
  }

  if (!forceNew && card.rank !== "Joker" && player.scorePile.length > 0) {
    const topGroup     = player.scorePile[player.scorePile.length - 1];
    const topGroupRank = topGroup.find(c => c.rank !== "Joker")?.rank;

    if (topGroupRank === card.rank) {
      player.hand.splice(index, 1);
      topGroup.push(card);

      if (topGroup.length >= 4) {
        player.scorePile.pop();
        splitIntoGroups(topGroup).forEach(g => player.scorePile.push(g));
      }

      player.totalScore = calcScore(player);
      setStatus(T().addedToGroup(player.name, cardLabel(card)), true);
      return true;
    }
  }

  const hasPair = player.hand.some((c, i) => i !== index && c.rank === card.rank);
  if (!hasPair) { setStatus(T().noPair(cardLabel(card))); return false; }

  player.hand.splice(index, 1);
  player.scorePile.push([card]);
  player.inCommitment = true;
  player.totalScore   = calcScore(player);
  setStatus(T().commitStart(player.name, cardLabel(card)), true);
  return true;
}


// ── 17. Posun tahu ─────────────────────────────────────────────────────────

function advanceTurn() {
  selectedCard        = null;
  pendingPopupAction  = null;
  pendingDiscardPopup = null;
  hideActionPopup();
  hideDiscardPopup();

  const numPlayers    = gameState.players.length;
  const totalSubTurns = numPlayers * gameState.currentHandSize;

  gameState.subTurnIndex++;
  gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % numPlayers;

  if (gameState.subTurnIndex >= totalSubTurns) {
    gameState.subTurnIndex = 0;
    gameState.currentRound++;

    if (checkStalemate()) return;

    dealCards();
    if (gameState.phase === "gameEnd") return;

    setStatus(T().newRound(gameState.currentRound), true);
  }

  renderAll();
  updateSkipButton();

  if (!currentPlayer().isHuman) {
    scheduleAiTurn();
  } else {
    if (currentPlayer().inCommitment) {
      setStatus(T().commitBlocked(currentPlayer().scorePile[currentPlayer().scorePile.length - 1][0].rank));
    } else {
      setStatus(T().yourTurn);
    }
  }
}


// ── 18. Score pile popup ───────────────────────────────────────────────────

function shouldShowScorePopup(playerIndex, cardId) {
  const player = gameState.players[playerIndex];
  if (player.inCommitment) return false;

  const found = findCardInHand(playerIndex, cardId);
  if (!found) return false;

  const { card, index } = found;
  if (card.rank === "Joker") return false;

  let canAddToGroup = false;
  if (player.scorePile.length > 0) {
    const topGroupRank = player.scorePile[player.scorePile.length - 1].find(c => c.rank !== "Joker")?.rank;
    canAddToGroup = topGroupRank === card.rank;
  }

  const hasPair = player.hand.some((c, i) => i !== index && c.rank === card.rank);
  return canAddToGroup && hasPair;
}

function showActionPopup(playerIndex, cardId) {
  pendingPopupAction = { playerIndex, cardId };
  document.getElementById("action-popup").classList.remove("hidden");
}

function hideActionPopup() {
  document.getElementById("action-popup")?.classList.add("hidden");
  pendingPopupAction = null;
}

function initPopupButtons() {
  document.getElementById("action-add").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!pendingPopupAction) return;
    const { playerIndex, cardId } = pendingPopupAction;
    const cardEl         = getCardElement(cardId);
    const toEl           = document.getElementById("score-pile-player");
    const targetRotation = calcScorePileRotation(playerIndex, cardId);
    hideActionPopup();
    if (playToScorePile(playerIndex, cardId, false)) {
      animateCard(cardEl, toEl, false, () => advanceTurn(), targetRotation);
    }
  });

  document.getElementById("action-new").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!pendingPopupAction) return;
    const { playerIndex, cardId } = pendingPopupAction;
    const cardEl         = getCardElement(cardId);
    const toEl           = document.getElementById("score-pile-player");
    // forceNew=true znamená vždy nový závazek → vždy 45°
    const targetRotation = 45;
    hideActionPopup();
    if (playToScorePile(playerIndex, cardId, true)) {
      animateCard(cardEl, toEl, false, () => advanceTurn(), targetRotation);
    }
  });
}


// ── 19. Discard popup ──────────────────────────────────────────────────────

function shouldShowDiscardPopup(playerIndex, cardId) {
  const player = gameState.players[playerIndex];
  if (player.inCommitment) return false;
  if (gameState.discardPile.length === 0) return false;

  const found = findCardInHand(playerIndex, cardId);
  if (!found) return false;

  const { card }   = found;
  const topCard    = gameState.discardPile[gameState.discardPile.length - 1];
  const handJoker  = card.rank === "Joker";
  const topJoker   = topCard.rank === "Joker";
  const rankMatch  = card.rank === topCard.rank;
  const jokerMatch = (handJoker && !topJoker) || (!handJoker && topJoker);

  return rankMatch || jokerMatch;
}

function showDiscardPopup(playerIndex, cardId) {
  pendingDiscardPopup = { playerIndex, cardId };
  const popup = document.getElementById("discard-popup");
  popup.classList.remove("hidden");
}

function hideDiscardPopup() {
  document.getElementById("discard-popup")?.classList.add("hidden");
  pendingDiscardPopup = null;
}

function initDiscardPopupButtons() {
  document.getElementById("discard-action-take").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!pendingDiscardPopup) return;
    const { playerIndex, cardId } = pendingDiscardPopup;
    const cardEl         = getCardElement(cardId);
    const toEl           = document.getElementById("score-pile-player");
    // takeFromDiscard vždy vytvoří novou skupinu → index = scorePile.length → sudý/lichý
    const player         = gameState.players[playerIndex];
    const targetRotation = player.scorePile.length % 2 === 0 ? 0 : 90;
    hideDiscardPopup();
    if (takeFromDiscard(playerIndex, cardId)) {
      animateCard(cardEl, toEl, false, () => advanceTurn(), targetRotation);
    }
  });

  document.getElementById("discard-action-discard").addEventListener("click", (e) => {
    e.stopPropagation();
    if (!pendingDiscardPopup) return;
    const { playerIndex, cardId } = pendingDiscardPopup;
    const cardEl        = getCardElement(cardId);
    const toEl          = document.getElementById("discard-pile");
    const targetRotation = ((cardId * 37 + 13) % 41) - 20;
    hideDiscardPopup();
    if (discardCard(playerIndex, cardId)) {
      animateCard(cardEl, toEl, false, () => advanceTurn(), targetRotation);
    }
  });
}

function positionDiscardPopup() {
  const popup = document.getElementById("discard-popup");
  const pile  = document.getElementById("discard-pile");
  if (!popup || !pile) return;

  const r = pile.getBoundingClientRect();

  // Vycentrujeme popup přesně na střed odhazovacího balíčku
  popup.style.left      = (r.left + r.width  / 2) + "px";
  popup.style.top       = (r.top  + r.height / 2) + "px";
  popup.style.transform = "translate(-50%, -50%)";
}


// ── 20. AI pomocné funkce ─────────────────────────────────────────────────

function aiGetPairs(hand) {
  const pairs = [];
  const seen  = {};
  for (const card of hand) {
    const rank = card.rank;
    if (seen[rank])                    { pairs.push({ card1: seen[rank], card2: card }); seen[rank] = null; }
    else if (seen[rank] === undefined) { seen[rank] = card; }
  }
  return pairs;
}

function aiGetDiscardMatches(hand) {
  if (gameState.discardPile.length === 0) return [];
  const topCard = gameState.discardPile[gameState.discardPile.length - 1];
  return hand.filter(card => {
    if (card.rank === "Joker" && topCard.rank === "Joker") return false;
    return card.rank === topCard.rank || card.rank === "Joker" || topCard.rank === "Joker";
  });
}

function aiGetStealOptions(hand, victim) {
  if (victim.scorePile.length === 0 || victim.inCommitment) return [];
  const topGroup   = victim.scorePile[victim.scorePile.length - 1];
  const stolenRank = topGroup.find(c => c.rank !== "Joker")?.rank;
  return hand.filter(card => {
    if (card.rank === "Joker" && topGroup.every(c => c.rank === "Joker")) return false;
    return card.rank === stolenRank || card.rank === "Joker";
  });
}

function aiCalcGroupValue(group) {
  return group.reduce((s, c) => s + c.value, 0);
}

function aiGetAddToGroupOptions(ai) {
  if (ai.inCommitment) return [];
  if (ai.scorePile.length === 0) return [];

  const topGroup     = ai.scorePile[ai.scorePile.length - 1];
  const topGroupRank = topGroup.find(c => c.rank !== "Joker")?.rank;
  if (!topGroupRank) return [];

  return ai.hand
    .filter(card => card.rank === topGroupRank)
    .map(card => ({ action: "addToGroup", cardId: card.id, gain: card.value }));
}

function aiGetAllMoves(ai, victim) {
  const moves = [];

  for (const { card1 } of aiGetPairs(ai.hand)) {
    if (card1.rank === "Joker") continue;
    moves.push({ action: "commit", cardId: card1.id, gain: card1.value * 2 });
  }

  const topDiscard = gameState.discardPile.length > 0
    ? gameState.discardPile[gameState.discardPile.length - 1] : null;
  for (const card of aiGetDiscardMatches(ai.hand)) {
    moves.push({ action: "takeDiscard", cardId: card.id, gain: card.value + topDiscard.value });
  }

  const topGroup = victim.scorePile.length > 0
    ? victim.scorePile[victim.scorePile.length - 1] : null;
  for (const card of aiGetStealOptions(ai.hand, victim)) {
    moves.push({ action: "steal", cardId: card.id, gain: topGroup ? aiCalcGroupValue(topGroup) - card.value : 0 });
  }

  moves.push(...aiGetAddToGroupOptions(ai));

  for (const card of ai.hand) {
    moves.push({ action: "discard", cardId: card.id, gain: -card.value });
  }

  return moves;
}

function aiDecideGodlike(ai, victim) {
  if (ai.inCommitment) {
    const neededRank = ai.scorePile[ai.scorePile.length - 1][0].rank;
    const matchCard  = ai.hand.find(c => c.rank === neededRank);
    if (matchCard) return { action: "commit-finish", cardId: matchCard.id };
    return { action: "discard", cardId: ai.hand.reduce((a, b) => a.value < b.value ? a : b).id };
  }

  const allMoves = aiGetAllMoves(ai, victim);

  const steals      = allMoves.filter(m => m.action === "steal"       && m.gain > 0);
  const commits     = allMoves.filter(m => m.action === "commit"      && m.gain > 0);
  const discards    = allMoves.filter(m => m.action === "takeDiscard" && m.gain > 0);
  const addToGroups = allMoves.filter(m => m.action === "addToGroup"  && m.gain > 0);
  const dumps       = allMoves.filter(m => m.action === "discard");

  const best = (arr) => arr.length > 0 ? arr.reduce((a, b) => a.gain >= b.gain ? a : b) : null;

  const bestSteal    = best(steals);
  const bestCommit   = best(commits);
  const bestDiscard  = best(discards);
  const bestAddGroup = best(addToGroups);

  const positives    = [bestCommit, bestDiscard, bestAddGroup].filter(Boolean);
  const bestPositive = positives.length > 0 ? positives.reduce((a, b) => a.gain >= b.gain ? a : b) : null;

  if (bestSteal && bestPositive) return bestSteal.gain >= bestPositive.gain ? bestSteal : bestPositive;
  if (bestSteal)    return bestSteal;
  if (bestPositive) return bestPositive;

  return dumps.length > 0 ? dumps.reduce((a, b) => a.gain > b.gain ? a : b)
                          : { action: "discard", cardId: ai.hand[0].id };
}

function aiDecide(ai, victim) {
  if (CONFIG.AI_LEVEL === 3) return aiDecideGodlike(ai, victim);

  if (ai.inCommitment) {
    const matchCard = ai.hand.find(c => c.rank === ai.scorePile[ai.scorePile.length - 1][0].rank);
    if (matchCard) return { action: "commit-finish", cardId: matchCard.id };
  }

  const allMoves   = aiGetAllMoves(ai, victim);
  const validMoves = CONFIG.AI_LEVEL === 1 ? allMoves.filter(m => m.action !== "steal") : allMoves;
  const filtered   = (CONFIG.AI_LEVEL === 2 && Math.random() > CONFIG.AI_OPTIMAL_CHANCE)
                   ? validMoves.filter(m => m.action !== "steal") : validMoves;

  const maxGain = Math.max(...filtered.map(m => m.gain));
  const best    = filtered.filter(m => m.gain === maxGain);
  return best[Math.floor(Math.random() * best.length)];
}


// ── 21. AI tah ─────────────────────────────────────────────────────────────

function scheduleAiTurn() {
  setStatus(T().aiThinking);
  setTimeout(() => {
    const ai     = currentPlayer();
    const victim = gameState.players.find(p => p.index !== ai.index);
    if (ai.hand.length === 0) return;

    const move = aiDecide(ai, victim);

    switch (move.action) {
      case "commit-finish":
      case "commit":       playToScorePile(ai.index, move.cardId); break;
      case "takeDiscard":  takeFromDiscard(ai.index, move.cardId); break;
      case "steal":        stealFromScorePile(ai.index, move.cardId, victim.index); break;
      case "addToGroup":   playToScorePile(ai.index, move.cardId, false); break;
      case "discard":      discardCard(ai.index, move.cardId); break;
      default:
        console.warn("Unknown AI action:", move.action);
        discardCard(ai.index, ai.hand[0].id);
    }

    advanceTurn();
  }, CONFIG.AI_DELAY_MS);
}


// ── 22. Systém dvou kliků ─────────────────────────────────────────────────

function onCardClick(playerIndex, cardId) {
  if (gameState.phase !== "playing") return;
  if (!currentPlayer().isHuman) return;
  if (playerIndex !== gameState.currentPlayerIndex) return;

  if (pendingPopupAction || pendingDiscardPopup) {
    hideActionPopup();
    hideDiscardPopup();
  }

  if (selectedCard && selectedCard.cardId === cardId) {
    selectedCard = null;
    if (currentPlayer().inCommitment) {
      setStatus(T().commitBlocked(currentPlayer().scorePile[currentPlayer().scorePile.length - 1][0].rank));
    } else {
      setStatus(T().yourTurn);
    }
  } else {
    selectedCard = { playerIndex, cardId };
    setStatus(T().selectTarget);
  }

  renderHand(gameState.players[0], "hand-player", true);
}

function onDiscardClick(e) {
  if (e) e.stopPropagation();
  if (!selectedCard || gameState.phase !== "playing" || !currentPlayer().isHuman) return;

  if (shouldShowDiscardPopup(selectedCard.playerIndex, selectedCard.cardId)) {
    positionDiscardPopup();
    showDiscardPopup(selectedCard.playerIndex, selectedCard.cardId);
  } else {
    resolveAction("discard");
  }
}

function onScorePileClick(playerIndex) {
  if (!selectedCard || gameState.phase !== "playing" || !currentPlayer().isHuman) return;

  if (playerIndex === gameState.currentPlayerIndex) {
    if (shouldShowScorePopup(selectedCard.playerIndex, selectedCard.cardId)) {
      showActionPopup(selectedCard.playerIndex, selectedCard.cardId);
      return;
    }
    resolveAction("score-self");
  } else {
    resolveAction("score-steal", playerIndex);
  }
}

function resolveAction(targetType, targetPlayerIndex) {
  if (!selectedCard) return;

  // ── Změna: místo přímého volání advanceTurn() předáme callback s animací ──

  if (targetType === "discard") {
    const cardEl = getCardElement(selectedCard.cardId);
    const toEl   = document.getElementById("discard-pile");

    // Spočítáme cílovou rotaci předem — stejný vzorec jako v renderDiscardPile()
    // Díky tomu karta přistane přesně ve své finální poloze, bez skoku.
    const cardId        = selectedCard.cardId;
    const targetRotation = ((cardId * 37 + 13) % 41) - 20;

    if (discardCard(selectedCard.playerIndex, selectedCard.cardId)) {
      animateCard(cardEl, toEl, false, () => advanceTurn(), targetRotation);
    }
    return;
  }

  if (targetType === "score-self") {
    const cardEl        = getCardElement(selectedCard.cardId);
    const toEl          = document.getElementById("score-pile-player");
    const wasCommitment = gameState.players[selectedCard.playerIndex].inCommitment;

    /*
     * Při dokončení závazku karta vždy letí na 45° — to je rotace závazku.
     * Po přistání se skupina plynule přetočí na 0° nebo 90°.
     * Při ostatních akcích (přiložení, nový závazek) počítáme rotaci normálně.
     */
    const flyRotation    = wasCommitment ? 45 : calcScorePileRotation(selectedCard.playerIndex, selectedCard.cardId);
    const targetRotation = wasCommitment ? calcScorePileRotation(selectedCard.playerIndex, selectedCard.cardId) : flyRotation;

    if (playToScorePile(selectedCard.playerIndex, selectedCard.cardId, false)) {
      animateCard(cardEl, toEl, false, () => {
        if (wasCommitment) gameState.animateLastGroupRotation = true;
        advanceTurn();
        gameState.animateLastGroupRotation = false;
      }, flyRotation);
    }
    return;
  }
  if (targetType === "score-steal") {
    if (stealFromScorePile(selectedCard.playerIndex, selectedCard.cardId, targetPlayerIndex)) advanceTurn();
    return;
  }
}


// ── 23. Animace ────────────────────────────────────────────────────────────

/*
 * ANIMAČNÍ DÉLKY podle CONFIG.ANIMATION_SPEED
 * Vrátí počet milisekund pro jednu animaci.
 */
function animDuration() {
  switch (CONFIG.ANIMATION_SPEED) {
    case "fast":  return 180;
    case "slow":  return 500;
    case "off":   return 0;
    default:      return 300; // "normal"
  }
}

/*
 * getCardElement(cardId)
 * Najde DOM element karty v ruce hráče podle cardId.
 * Karty mají data-card-id atribut nastavený při renderování.
 * Vrátí element nebo null.
 */
function getCardElement(cardId) {
  return document.querySelector(`[data-card-id="${cardId}"]`);
}

/*
 * calcScorePileRotation(playerIndex, cardId)
 *
 * Spočítá cílovou rotaci karty na score pile — musíme volat PŘED herní logikou,
 * protože logika změní scorePile a už bychom nevěděli jaký index skupina dostane.
 *
 * Kopíruje stejnou logiku jako renderScorePile():
 *   - závazek (karta nemá pár v pile) → 45°
 *   - sudý index skupiny → 0°
 *   - lichý index skupiny → 90°
 *
 * "Jaký index dostane nová/upravená skupina?" závisí na akci:
 *   - nová skupina (závazek nebo přiložení na novou) → scorePile.length (bude přidána na konec)
 *   - přiložení na existující vrchní skupinu → scorePile.length - 1 (existující index)
 *   - dokončení závazku → scorePile.length - 1 (dokončuje se poslední skupina)
 */
function calcScorePileRotation(playerIndex, cardId) {
  const player = gameState.players[playerIndex];
  const found  = findCardInHand(playerIndex, cardId);
  if (!found) return 0;

  const { card, index } = found;

  // Dokončení závazku — poslední skupina přestane být závazek → dostane normální rotaci
  if (player.inCommitment) {
    const groupIndex = player.scorePile.length - 1;
    return groupIndex % 2 === 0 ? 0 : 90;
  }

  // Přiložení na existující skupinu stejného ranku
  if (card.rank !== "Joker" && player.scorePile.length > 0) {
    const topGroupRank = player.scorePile[player.scorePile.length - 1].find(c => c.rank !== "Joker")?.rank;
    if (topGroupRank === card.rank) {
      const groupIndex = player.scorePile.length - 1;
      return groupIndex % 2 === 0 ? 0 : 90;
    }
  }

  // Nový závazek — skupina s 1 kartou → vždy 45°
  return 45;
}

/*
 * animateCard(fromEl, toEl, flip, callback, targetRotation)
 *
 * fromEl         — zdrojový DOM element (karta v ruce) nebo null
 * toEl           — cílový DOM element (discard pile, score pile...)
 * flip           — true = otočit z rubu na líc během letu
 * callback       — zavolá se po skončení animace
 * targetRotation — volitelné: cílová rotace karty ve stupních (např. pro odhaz)
 *                  Karta se během letu plynule natočí do této pozice.
 *                  Bez tohoto parametru přistane rovně (0°).
 */
function animateCard(fromEl, toEl, flip, callback, targetRotation = 0) {
  const duration = animDuration();

  // Pokud jsou animace vypnuté nebo nemáme zdrojový element, rovnou callback
  if (duration === 0 || !fromEl || !toEl) {
    renderAll();
    callback();
    return;
  }

  const fromRect = fromEl.getBoundingClientRect();
  const toRect   = toEl.getBoundingClientRect();

  // Cílová pozice = střed cílového elementu, vycentrovaný na kartu
  const targetLeft = toRect.left + (toRect.width  - 138) / 2;
  const targetTop  = toRect.top  + (toRect.height - 198) / 2;

  // ── Vytvoříme klon ────────────────────────────────────────────────────────
  //
  // Klon zkopíruje HTML obsah zdrojové karty (má správné rank/suit/barvu).
  // Zabalíme ho do .flying-card kontejneru s position:fixed.
  //
  const clone = document.createElement("div");
  clone.style.cssText = `
    position: fixed;
    left: ${fromRect.left}px;
    top:  ${fromRect.top}px;
    width: 138px;
    height: 198px;
    perspective: 600px;
    pointer-events: none;
    z-index: 9999;
    will-change: transform;
  `;

  // Vnitřní wrapper — na něm poběží transition
  const inner = document.createElement("div");
  inner.style.cssText = `
    position: relative;
    width: 100%;
    height: 100%;
    transform-style: preserve-3d;
    transition: transform ${duration}ms ease;
  `;

  if (flip) {
    // Flip: potřebujeme dvě strany (rub + líc)
    // Rub — viditelný na začátku
    const back = document.createElement("div");
    back.style.cssText = `
      position: absolute; inset: 0;
      border-radius: 7px;
      background: repeating-linear-gradient(135deg, #1e4030, #1e4030 4px, #172e23 4px, #172e23 8px);
      border: 1px solid #7a6030;
      box-shadow: -2px 2px 8px rgba(0,0,0,0.5);
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
    `;

    // Líc — zkopírujeme obsah zdrojové karty, otočíme o 180° (na začátku skrytý)
    const front = document.createElement("div");
    front.style.cssText = `
      position: absolute; inset: 0;
      border-radius: 7px;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
      transform: rotateY(180deg);
    `;
    // Zkopírujeme vizuál z originálu
    front.innerHTML = fromEl.innerHTML;
    // Zkopírujeme třídy pro správnou barvu (red, joker...)
    front.className = fromEl.className;
    front.style.cssText += `
      position: absolute; inset: 0;
      border-radius: 7px;
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
      transform: rotateY(180deg);
    `;

    inner.appendChild(back);
    inner.appendChild(front);
  } else {
    // Bez flipu — jen zkopírujeme vizuál karty
    const face = document.createElement("div");
    face.innerHTML  = fromEl.innerHTML;
    face.className  = fromEl.className;
    face.style.cssText = `
      position: absolute; inset: 0;
      border-radius: 7px;
    `;
    inner.appendChild(face);
  }

  clone.appendChild(inner);
  document.body.appendChild(clone);

  // Schováme originál aby nebyly vidět dva exempláře
  fromEl.style.opacity = "0";

  // ── Spustíme animaci ──────────────────────────────────────────────────────

  const dx = targetLeft - fromRect.left;
  const dy = targetTop  - fromRect.top;

  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      /*
       * Finální transform kombinuje tři věci zároveň:
       * 1. translate  — pohyb z A do B
       * 2. rotate     — natočení do cílové pozice (pro odhaz = náhodný náklon)
       * 3. rotateY    — flip z rubu na líc (pouze pokud flip=true)
       *
       * Pořadí: translate první — karta se posune v původním souřadném systému,
       * ne ve svém vlastním natočeném.
       */
      if (flip) {
        inner.style.transform = `translate(${dx}px, ${dy}px) rotate(${targetRotation}deg) rotateY(180deg)`;
      } else {
        inner.style.transform = `translate(${dx}px, ${dy}px) rotate(${targetRotation}deg)`;
      }
    });
  });

  // ── Po skončení animace ───────────────────────────────────────────────────

  inner.addEventListener("transitionend", () => {
    clone.remove();
    // Originál necháme schovaný — renderAll() ho stejně přepíše celý innerHTML
    renderAll();
    callback();
  }, { once: true });
}


// ── 24. Renderování ────────────────────────────────────────────────────────

function createCardElement(card, faceUp, isSelected = false) {
  const el = document.createElement("div");
  el.classList.add("card");

  if (!faceUp) { el.classList.add("face-down"); return el; }

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

  // ── Klíčová změna: data-card-id atribut ──────────────────────────────────
  // Díky tomu getCardElement(cardId) najde správný DOM element.
  el.dataset.cardId = card.id;

  return el;
}

function renderHand(player, containerId, clickable = false, fanDown = false) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = "";

  const cards = player.hand;
  if (cards.length === 0) { container.style.width = "0"; container.style.height = "0"; return; }

  const CARD_W = 138;
  const CARD_H = 198;
  const SPREAD = fanDown ? 3  : 3;
  const STEP   = fanDown ? 14 : 14;
  const RADIUS = 500;

  const n          = cards.length;
  const totalAngle = SPREAD * (n - 1);
  const startAngle = -totalAngle / 2;

  const W = CARD_W + (n - 1) * STEP + 20;
  const H = CARD_H + 30;

  container.style.width  = W + "px";
  container.style.height = H + "px";

  if (fanDown) {
    const SPREAD_OPP = 3;
    const STEP_OPP   = 14;
    const RADIUS_OPP = 500;
    const n2         = cards.length;
    const totalAngle2 = SPREAD_OPP * (n2 - 1);
    const startAngle2 = -totalAngle2 / 2;

    const W2 = CARD_W + (n2 - 1) * STEP_OPP + 20;
    const H2 = CARD_H + 30;

    container.style.width     = W2 + "px";
    container.style.height    = H2 + "px";
    container.style.transform = `rotate(180deg) translateY(${CARD_H + 100}px)`;
    container.style.transformOrigin = "50% 100%";

    const cy2 = H2 + RADIUS_OPP;
    const endAngleRad2 = ((startAngle2 + (n2-1) * SPREAD_OPP) * Math.PI) / 180;
    const cx2 = W2 - CARD_W / 2 - RADIUS_OPP * Math.sin(endAngleRad2);

    cards.forEach((card, i) => {
      const el       = createCardElement(card, false, false);
      const angleDeg = startAngle2 + i * SPREAD_OPP;
      const angleRad = angleDeg * Math.PI / 180;

      const left = cx2 + RADIUS_OPP * Math.sin(angleRad) - CARD_W / 2;
      const top  = cy2 - RADIUS_OPP * Math.cos(angleRad) - CARD_H;

      el.style.position        = "absolute";
      el.style.left            = left + "px";
      el.style.top             = top  + "px";
      el.style.zIndex          = String(i + 1);
      el.style.transformOrigin = `${CARD_W / 2}px ${CARD_H}px`;
      el.style.transform       = `rotate(${angleDeg}deg)`;

      container.appendChild(el);
    });

  } else {
    const cy = H + RADIUS;
    const endAngleRad = ((startAngle + (n-1) * SPREAD) * Math.PI) / 180;
    const cx = W - CARD_W / 2 - RADIUS * Math.sin(endAngleRad);

    cards.forEach((card, i) => {
      const isSelected = selectedCard?.playerIndex === player.index
                      && selectedCard?.cardId === card.id;

      const el       = createCardElement(card, true, isSelected);
      const angleDeg = startAngle + i * SPREAD;
      const angleRad = angleDeg * Math.PI / 180;

      const left = cx + RADIUS * Math.sin(angleRad) - CARD_W / 2;
      const top  = cy - RADIUS * Math.cos(angleRad) - CARD_H;

      el.style.position        = "absolute";
      el.style.left            = left + "px";
      el.style.top             = top  + "px";
      el.style.zIndex          = String(i + 1);
      el.style.transformOrigin = `${CARD_W / 2}px ${CARD_H}px`;

      if (isSelected) {
        el.style.transform = `translateY(-24px) scale(1.05) rotate(${angleDeg}deg)`;
        el.style.zIndex    = "50";
      } else {
        el.style.transform = `rotate(${angleDeg}deg)`;
        const base = `rotate(${angleDeg}deg)`;
        el.addEventListener("mouseenter", () => {
          el.style.transform  = `translateY(-16px) scale(1.08) ${base}`;
          el.style.transition = "transform 0.12s ease";
        });
        el.addEventListener("mouseleave", () => {
          el.style.transform  = base;
          el.style.transition = "transform 0.12s ease";
        });
      }

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onCardClick(player.index, card.id);
      });

      container.appendChild(el);
    });
  }
}

function renderDiscardPile() {
  const wrapper = document.getElementById("discard-pile-cards");
  const countEl = document.getElementById("discard-count");
  if (!wrapper) return;

  wrapper.innerHTML = "";
  gameState.discardPile.slice(-3).forEach((card, i) => {
    const el = createCardElement(card, true);
    el.style.transform = `rotate(${((card.id * 37 + 13) % 41) - 20}deg)`;
    el.style.zIndex    = String(i + 1);
    wrapper.appendChild(el);
  });

  if (countEl) countEl.textContent = gameState.discardPile.length;
}

function renderDrawPile() {
  const countEl = document.getElementById("draw-count");
  if (countEl) countEl.textContent = gameState.drawPile.length;
}

function renderScorePile(player, slotId, countId, scoreId) {
  const slot = document.getElementById(slotId);
  if (!slot) return;
  slot.innerHTML = "";

  if (player.scorePile.length === 0) {
    slot.innerHTML = `<span class="empty-label">empty</span>`;
  } else {
    const isPlayerSlot = slotId === "score-pile-player";
    const animateLast  = isPlayerSlot && gameState.animateLastGroupRotation;

    player.scorePile.forEach((group, idx) => {
      const isCommitment = group.length === 1;
      const isTopTwo     = idx >= player.scorePile.length - 2;
      const hasJoker     = isTopTwo && group.some(c => c.rank === "Joker");
      const rotation     = isCommitment ? 45 : (idx % 2 === 0 ? 0 : 90);
      const isLast       = idx === player.scorePile.length - 1;

      const wrapper = document.createElement("div");
      wrapper.classList.add("score-group");
      if (isCommitment) wrapper.classList.add("commitment");
      if (hasJoker)     wrapper.classList.add("has-joker");
      wrapper.style.zIndex = String(idx + 1);

      if (animateLast && isLast) {
        /*
         * Tato skupina právě přešla ze závazku (45°) na normální rotaci.
         * Vykreslíme ji na 45° a pak pomocí rAF spustíme CSS transition na cílovou rotaci.
         * Tím hráč vidí plynulé překlopení místo okamžitého skoku.
         */
        wrapper.style.transform  = `rotate(45deg)`;
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            wrapper.style.transition = `transform ${animDuration()}ms ease`;
            wrapper.style.transform  = `rotate(${rotation}deg)`;
          });
        });
      } else {
        wrapper.style.transform = `rotate(${rotation}deg)`;
      }

      group.forEach((card, ci) => {
        const el = createCardElement(card, true);
        el.style.cssText = `position:absolute;top:${ci*5}px;left:${ci*3}px;z-index:${ci+1};`;
        wrapper.appendChild(el);
      });

      slot.appendChild(wrapper);
    });
  }

  document.getElementById(countId).textContent = player.scorePile.length > 0 ? player.scorePile.length : "";
  document.getElementById(scoreId).textContent = calcScore(player);
}

function renderAll() {
  const human    = gameState.players[0];
  const opponent = gameState.players[1];

  renderHand(human,    "hand-player",   true,  false);
  renderHand(opponent, "hand-opponent", false, true);

  renderScorePile(human,    "score-pile-player",   "score-count-player",   "score-player");
  renderScorePile(opponent, "score-pile-opponent", "score-count-opponent", "score-opponent");

  renderDiscardPile();
  renderDrawPile();

  document.getElementById("discard-pile")
    .classList.toggle("target-highlight", selectedCard !== null);
  document.getElementById("score-pile-player")
    .classList.toggle("target-highlight", selectedCard !== null);

  const opp = gameState.players[1];
  document.getElementById("score-pile-opponent")
    .classList.toggle("target-highlight",
      selectedCard !== null && !opp.inCommitment && opp.scorePile.length > 0
    );
}


// ── Inicializace listenerů ─────────────────────────────────────────────────

function initListeners() {
  document.getElementById("discard-pile")
    .addEventListener("click", (e) => onDiscardClick(e));

  document.getElementById("score-pile-player")
    .addEventListener("click", (e) => { e.stopPropagation(); onScorePileClick(0); });

  document.getElementById("score-pile-opponent")
    .addEventListener("click", () => onScorePileClick(1));

  document.getElementById("skip-game-btn")
    .addEventListener("click", () => {
      if (gameState.phase === "playing") endGame("stalemate");
    });

  document.addEventListener("click", () => {
    if (pendingPopupAction) {
      hideActionPopup();
      selectedCard = null;
      renderHand(gameState.players[0], "hand-player", true);
      setStatus(currentPlayer().inCommitment
        ? T().commitBlocked(currentPlayer().scorePile[currentPlayer().scorePile.length - 1][0].rank)
        : T().yourTurn);
    }
    if (pendingDiscardPopup) {
      hideDiscardPopup();
      selectedCard = null;
      renderHand(gameState.players[0], "hand-player", true);
      setStatus(T().yourTurn);
    }
  });
}


// ── Spuštění ───────────────────────────────────────────────────────────────

initListeners();
initPopupButtons();
initDiscardPopupButtons();
initStatusLogToggle();
initGame(2);
