/**
 * ZLODĚJ – Card Game
 * game.js – Vlákno 7: Opravy bugů — splitIntoGroups, takeFromDiscard, currentHandSize
 */

// ── 1. Lokalizace ──────────────────────────────────────────────────────────

const LANG = {
  en: {
    playerName:       "Player",
    aiName:           "Computer",
    draw:             "Draw",
    discard:          "Discard",
    scorePile:        "Score",
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
  },
  cs: {
    playerName:       "Hráč",
    aiName:           "Počítač",
    draw:             "Dobírací",
    discard:          "Odhoz",
    scorePile:        "Body",
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
  AI_LEVEL:              2,
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

/**
 * dealCards()
 *
 * Rozdává střídavě po jedné kartě všem hráčům dokud:
 *   a) každý má CONFIG.HAND_SIZE karet, nebo
 *   b) dojdou karty
 *
 * Zdroj karet:
 *   - Primárně dobírací balíček (pop = vrchní karta)
 *   - Pokud je prázdný → odhazovací balíček (shift = spodní = nejstarší)
 *   - Odhazovací balíček se NIKDY nemíchá
 *   - Zbývající karty odhazu zůstávají jako odhaz
 *
 * Každý hráč dostane vždy stejný počet (rozdáváme celá kolečka).
 * Skutečný počet rozdaných karet se uloží do gameState.currentHandSize
 * aby advanceTurn() věděl kdy kolo končí.
 */
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

  // Rozdáváme celá kolečka — každý hráč dostane vždy stejný počet
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

  // Uložíme skutečný počet karet v ruce — advanceTurn() podle toho pozná konec kola
  gameState.currentHandSize = dealtPerPlayer;
  gameState.phase           = "playing";
}


// ── 7. Detekce stagnace a konec hry ───────────────────────────────────────

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
  renderAll();
}


// ── 8. Inicializace ────────────────────────────────────────────────────────

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
    currentHandSize:    CONFIG.HAND_SIZE,
    phase:              "init",
    seriesScores:       players.map(() => 0),
    stalemateCount:     0,
    scoresBefore:       players.map(() => 0),
  };

  dealCards();
  setStatus(T().newRound(1));
  renderAll();

  if (!currentPlayer().isHuman) scheduleAiTurn();
}


// ── 9. Pomocné funkce ──────────────────────────────────────────────────────

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


// ── 10. Algoritmus rozdělení karet do skupin ──────────────────────────────

/**
 * splitIntoGroups(cards)
 *
 * Oprava: pokud je lichý počet normálních karet A máme žolíka,
 * žolík "vyrovná" lichost — spodní skupina = [žolík, normální],
 * místo aby se žolík přidal ke skupině tří.
 *
 * Příklad: žolík + 6 + 6 + 6
 *   Před opravou: [[žolík, 6, 6, 6]]         ✗
 *   Po opravě:    [[žolík, 6], [6, 6]]        ✓
 */
function splitIntoGroups(cards) {
  const jokers  = cards.filter(c => c.rank === "Joker");
  const normals = cards.filter(c => c.rank !== "Joker");

  const groups = [];
  let i = 0;

  if (normals.length % 2 !== 0) {
    if (jokers.length > 0) {
      // Žolík vyrovná lichý počet — spodní skupina = žolík + 1 normální
      groups.push([jokers.shift(), normals[0]]);
      i = 1;
    } else {
      // Žádný žolík — spodní skupina dostane 3 normální
      groups.push(normals.slice(0, 3));
      i = 3;
    }
  }

  // Zbytek normálních po dvou
  while (i < normals.length) {
    groups.push(normals.slice(i, i + 2));
    i += 2;
  }

  if (groups.length === 0 && jokers.length > 0) {
    console.warn("splitIntoGroups: only jokers, no normal cards");
    groups.push([]);
  }

  // Zbývající žolíci odspodu — jeden do každé skupiny
  jokers.forEach((joker, idx) => {
    if (idx < groups.length) {
      groups[idx].unshift(joker);
    }
  });

  return groups;
}


// ── 11. Akce: krádež z bodovacího balíčku ────────────────────────────────

function stealFromScorePile(thiefIndex, cardId, victimIndex) {
  const thief  = gameState.players[thiefIndex];
  const victim = gameState.players[victimIndex];

  if (thief.inCommitment) {
    const neededRank = thief.scorePile[thief.scorePile.length - 1][0].rank;
    setStatus(T().commitBlocked(neededRank));
    return false;
  }

  if (victim.scorePile.length === 0) {
    setStatus(T().cantStealEmpty);
    return false;
  }

  if (victim.inCommitment) {
    setStatus(T().cantSteal);
    return false;
  }

  const found = findCardInHand(thiefIndex, cardId);
  if (!found) return false;

  const { card: thiefCard, index: thiefIndex2 } = found;
  const stolenGroup = victim.scorePile[victim.scorePile.length - 1];

  const thiefIsJoker  = thiefCard.rank === "Joker";
  const stolenIsJoker = stolenGroup.some(c => c.rank === "Joker");
  const stolenRank    = stolenGroup.find(c => c.rank !== "Joker")?.rank;

  if (!thiefIsJoker && thiefCard.rank !== stolenRank) {
    setStatus(T().cantStealRank);
    return false;
  }

  if (thiefIsJoker && stolenIsJoker && stolenGroup.every(c => c.rank === "Joker")) {
    setStatus(T().cantStealRank);
    return false;
  }

  thief.hand.splice(thiefIndex2, 1);
  victim.scorePile.pop();
  victim.totalScore = calcScore(victim);

  const stealRank = thiefIsJoker ? stolenRank : thiefCard.rank;

  let ownGroup = [];
  if (thief.scorePile.length > 0) {
    const topGroup     = thief.scorePile[thief.scorePile.length - 1];
    const topGroupRank = topGroup.find(c => c.rank !== "Joker")?.rank;
    if (topGroupRank === stealRank) {
      ownGroup = thief.scorePile.pop();
    }
  }

  const allCards  = [thiefCard, ...stolenGroup, ...ownGroup];
  const newGroups = splitIntoGroups(allCards);
  newGroups.forEach(group => thief.scorePile.push(group));
  thief.totalScore = calcScore(thief);

  setStatus(T().stolen(thief.name, cardLabel(thiefCard)), true);
  return true;
}


// ── 12. Akce: odhoz karty ─────────────────────────────────────────────────

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


// ── 13. Akce: vzít z odhazovacího balíčku ────────────────────────────────

/**
 * takeFromDiscard()
 *
 * Dočasné logování pro diagnostiku Bug 3 (zmizení karet).
 * Odstraníme až bude bug potvrzen jako vyřešený.
 */
function takeFromDiscard(playerIndex, cardId) {
  const player = gameState.players[playerIndex];

  if (player.inCommitment) {
    const neededRank = player.scorePile[player.scorePile.length - 1][0].rank;
    setStatus(T().commitBlocked(neededRank));
    return false;
  }

  const found = findCardInHand(playerIndex, cardId);
  if (!found) return false;

  const { card, index } = found;

  if (gameState.discardPile.length === 0) {
    return discardCard(playerIndex, cardId);
  }

  const topCard   = gameState.discardPile[gameState.discardPile.length - 1];
  const handJoker = card.rank === "Joker";
  const topJoker  = topCard.rank === "Joker";

  const rankMatch  = card.rank === topCard.rank;
  const jokerMatch = (handJoker && !topJoker) || (!handJoker && topJoker);

  if (!rankMatch && !jokerMatch) {
    return discardCard(playerIndex, cardId);
  }

  let group;
  if (handJoker) {
    group = [card, topCard];
  } else if (topJoker) {
    group = [topCard, card];
  } else {
    group = [card, topCard];
  }

  // Dočasné logování — Bug 3
  console.log(
    `[takeFromDiscard] ${player.name} | ruka: ${cardLabel(card)} + odhaz: ${cardLabel(topCard)}`,
    `→ skupina:`, group.map(cardLabel),
    `| scorePile před:`, player.scorePile.length, `skupin`
  );

  player.hand.splice(index, 1);
  gameState.discardPile.pop();
  player.scorePile.push(group);
  player.totalScore = calcScore(player);

  console.log(
    `[takeFromDiscard] scorePile po:`, player.scorePile.length, `skupin`,
    `| skóre:`, player.totalScore
  );

  setStatus(T().tookFromDiscard(player.name, cardLabel(card)), true);
  return true;
}


// ── 14. Akce: vyložení na bodovací balíček ────────────────────────────────

function playToScorePile(playerIndex, cardId) {
  const player = gameState.players[playerIndex];
  const found  = findCardInHand(playerIndex, cardId);
  if (!found) return false;

  const { card, index } = found;

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

  const hasPair = player.hand.some((c, i) => i !== index && c.rank === card.rank);

  if (hasPair) {
    player.hand.splice(index, 1);
    player.scorePile.push([card]);
    player.inCommitment = true;
    player.totalScore   = calcScore(player);

    setStatus(T().commitStart(player.name, cardLabel(card)), true);
    return true;
  }

  if (card.rank !== "Joker" && player.scorePile.length > 0) {
    const topGroup     = player.scorePile[player.scorePile.length - 1];
    const topGroupRank = topGroup.find(c => c.rank !== "Joker")?.rank;

    if (topGroupRank === card.rank) {
      player.hand.splice(index, 1);
      topGroup.push(card);

      if (topGroup.length >= 4) {
        player.scorePile.pop();
        const newGroups = splitIntoGroups(topGroup);
        newGroups.forEach(g => player.scorePile.push(g));
      }

      player.totalScore = calcScore(player);
      setStatus(T().addedToGroup(player.name, cardLabel(card)), true);
      return true;
    }
  }

  setStatus(T().noPair(cardLabel(card)));
  return false;
}


// ── 15. Posun tahu ─────────────────────────────────────────────────────────

/**
 * advanceTurn()
 *
 * Oprava Bug 4: totalSubTurns používá gameState.currentHandSize
 * místo pevného CONFIG.HAND_SIZE — reflektuje skutečný počet
 * rozdaných karet i při méně než 6 kartách na ruku.
 */
function advanceTurn() {
  selectedCard = null;

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


// ── 16. AI pomocné funkce ─────────────────────────────────────────────────

function aiGetPairs(hand) {
  const pairs = [];
  const seen  = {};

  for (const card of hand) {
    const rank = card.rank;
    if (seen[rank]) {
      pairs.push({ card1: seen[rank], card2: card });
      seen[rank] = null;
    } else if (seen[rank] === undefined) {
      seen[rank] = card;
    }
  }

  return pairs;
}

function aiGetDiscardMatches(hand) {
  if (gameState.discardPile.length === 0) return [];

  const topCard = gameState.discardPile[gameState.discardPile.length - 1];
  const matches = [];

  for (const card of hand) {
    const bothJokers = card.rank === "Joker" && topCard.rank === "Joker";
    if (bothJokers) continue;

    const rankMatch  = card.rank === topCard.rank;
    const jokerMatch = card.rank === "Joker" || topCard.rank === "Joker";

    if (rankMatch || jokerMatch) {
      matches.push(card);
    }
  }

  return matches;
}

function aiGetStealOptions(hand, victim) {
  if (victim.scorePile.length === 0) return [];
  if (victim.inCommitment) return [];

  const topGroup   = victim.scorePile[victim.scorePile.length - 1];
  const stolenRank = topGroup.find(c => c.rank !== "Joker")?.rank;
  const matches    = [];

  for (const card of hand) {
    const bothJokers = card.rank === "Joker" && topGroup.every(c => c.rank === "Joker");
    if (bothJokers) continue;

    const rankMatch  = card.rank === stolenRank;
    const jokerMatch = card.rank === "Joker";

    if (rankMatch || jokerMatch) {
      matches.push(card);
    }
  }

  return matches;
}

function aiCalcGroupValue(group) {
  return group.reduce((sum, card) => sum + card.value, 0);
}

function aiGetAllMoves(ai, victim) {
  const moves = [];

  const pairs = aiGetPairs(ai.hand);
  for (const { card1, card2 } of pairs) {
    if (card1.rank === "Joker") continue;
    const gain = card1.value + card2.value;
    moves.push({ action: "commit", cardId: card1.id, gain });
  }

  const discardMatches = aiGetDiscardMatches(ai.hand);
  const topDiscard     = gameState.discardPile.length > 0
                       ? gameState.discardPile[gameState.discardPile.length - 1]
                       : null;
  for (const card of discardMatches) {
    const gain = card.value + topDiscard.value;
    moves.push({ action: "takeDiscard", cardId: card.id, gain });
  }

  const stealOptions = aiGetStealOptions(ai.hand, victim);
  const topGroup     = victim.scorePile.length > 0
                     ? victim.scorePile[victim.scorePile.length - 1]
                     : null;
  for (const card of stealOptions) {
    const gain = topGroup ? aiCalcGroupValue(topGroup) - card.value : 0;
    moves.push({ action: "steal", cardId: card.id, gain });
  }

  for (const card of ai.hand) {
    moves.push({ action: "discard", cardId: card.id, gain: -card.value });
  }

  return moves;
}

function aiDecide(ai, victim) {
  if (ai.inCommitment) {
    const neededRank = ai.scorePile[ai.scorePile.length - 1][0].rank;
    const matchCard  = ai.hand.find(c => c.rank === neededRank);
    if (matchCard) return { action: "commit-finish", cardId: matchCard.id };
  }

  const allMoves = aiGetAllMoves(ai, victim);

  if (allMoves.length === 0) {
    console.warn("aiDecide: no moves found, falling back to discard");
    const cheapest = ai.hand.reduce((a, b) => a.value < b.value ? a : b);
    return { action: "discard", cardId: cheapest.id };
  }

  const validMoves = CONFIG.AI_LEVEL === 1
    ? allMoves.filter(m => m.action !== "steal")
    : allMoves;

  const filteredMoves = (CONFIG.AI_LEVEL === 2 && Math.random() > CONFIG.AI_OPTIMAL_CHANCE)
    ? validMoves.filter(m => m.action !== "steal")
    : validMoves;

  const maxGain = Math.max(...filteredMoves.map(m => m.gain));
  const best    = filteredMoves.filter(m => m.gain === maxGain);

  return best[Math.floor(Math.random() * best.length)];
}


// ── 17. AI tah ─────────────────────────────────────────────────────────────

function scheduleAiTurn() {
  setStatus(T().aiThinking);
  setTimeout(() => {
    const ai     = currentPlayer();
    const victim = gameState.players.find(p => p.index !== ai.index);

    if (ai.hand.length === 0) return;

    const move = aiDecide(ai, victim);

    switch (move.action) {
      case "commit-finish":
      case "commit":
        playToScorePile(ai.index, move.cardId);
        break;
      case "takeDiscard":
        takeFromDiscard(ai.index, move.cardId);
        break;
      case "steal":
        stealFromScorePile(ai.index, move.cardId, victim.index);
        break;
      case "discard":
        discardCard(ai.index, move.cardId);
        break;
      default:
        console.warn("scheduleAiTurn: unknown action", move.action);
        discardCard(ai.index, ai.hand[0].id);
    }

    advanceTurn();
  }, CONFIG.AI_DELAY_MS);
}


// ── 18. Systém dvou kliků ─────────────────────────────────────────────────

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

  if (playerIndex === gameState.currentPlayerIndex) {
    resolveAction("score-self");
  } else {
    resolveAction("score-steal", playerIndex);
  }
}

function resolveAction(targetType, targetPlayerIndex) {
  if (!selectedCard) return;

  if (targetType === "discard") {
    const ok = takeFromDiscard(selectedCard.playerIndex, selectedCard.cardId);
    if (ok) advanceTurn();
    return;
  }

  if (targetType === "score-self") {
    const ok = playToScorePile(selectedCard.playerIndex, selectedCard.cardId);
    if (ok) advanceTurn();
    return;
  }

  if (targetType === "score-steal") {
    const ok = stealFromScorePile(selectedCard.playerIndex, selectedCard.cardId, targetPlayerIndex);
    if (ok) advanceTurn();
    return;
  }

  console.log("Target type not yet implemented:", targetType);
}


// ── 19. Renderování ────────────────────────────────────────────────────────

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

  if (countEl) countEl.textContent = pile.length;
}

function renderDrawPile() {
  const countEl = document.getElementById("draw-count");
  if (countEl) countEl.textContent = gameState.drawPile.length;
}

/**
 * renderScorePile()
 *
 * Duhový okraj (.has-joker) se zobrazuje pouze na vrchních dvou
 * skupinách balíčku — ty jsou jako jediné viditelné hráči.
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
      const isTopTwo     = absoluteIndex >= pile.length - 2;
      const hasJoker     = isTopTwo && group.some(c => c.rank === "Joker");

      let rotation;
      if (isCommitment) {
        rotation = 45;
      } else {
        rotation = absoluteIndex % 2 === 0 ? 0 : 90;
      }

      const wrapper = document.createElement("div");
      wrapper.classList.add("score-group");
      if (isCommitment) wrapper.classList.add("commitment");
      if (hasJoker)     wrapper.classList.add("has-joker");
      wrapper.style.transform = `rotate(${rotation}deg)`;
      wrapper.style.zIndex    = absoluteIndex + 1;

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

  const countEl = document.getElementById(countId);
  if (countEl) countEl.textContent = pile.length > 0 ? pile.length : "";

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

  document.getElementById("discard-pile")
    .classList.toggle("target-highlight", selectedCard !== null);
  document.getElementById("score-pile-player")
    .classList.toggle("target-highlight", selectedCard !== null);

  const opponent2 = gameState.players[1];
  const stealable = selectedCard !== null
                 && !opponent2.inCommitment
                 && opponent2.scorePile.length > 0;
  document.getElementById("score-pile-opponent")
    .classList.toggle("target-highlight", stealable);
}


// ── Inicializace listenerů ─────────────────────────────────────────────────

function initListeners() {
  document.getElementById("discard-pile")
    .addEventListener("click", onDiscardClick);

  document.getElementById("score-pile-player")
    .addEventListener("click", () => onScorePileClick(0));

  document.getElementById("score-pile-opponent")
    .addEventListener("click", () => onScorePileClick(1));
}


// ── Spuštění ───────────────────────────────────────────────────────────────

initListeners();
initGame(2);
