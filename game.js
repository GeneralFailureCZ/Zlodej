/**
 * ZLODĚJ – Card Game
 * game.js – Vlákno 6: Krádež z bodovacího balíčku + algoritmus rozdělení
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

  // ── DOČASNÉ: testovací skupina na bodovacím balíčku AI ──
  // Smazat až bude fungovat AI logika krádeže.
  if (gameState.currentRound === 1) {
  const ai        = gameState.players[1];
  const firstCard = gameState.drawPile.pop();
  const pairCard  = gameState.drawPile.find(c => c.rank === firstCard.rank);
  if (pairCard) {
    gameState.drawPile.splice(gameState.drawPile.indexOf(pairCard), 1);
    ai.scorePile.push([firstCard, pairCard]);
    ai.totalScore = calcScore(ai);
  } else {
    gameState.drawPile.push(firstCard);
  }
  } // konec if currentRound === 1
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


// ── 9. Algoritmus rozdělení karet do skupin ───────────────────────────────

/**
 * splitIntoGroups(cards) – rozdělí pole karet do skupin podle pravidel.
 *
 * Pravidla:
 *   - Skupiny po 2 kartách
 *   - Spodní skupina může mít 3 karty (pokud je celkový počet lichý)
 *   - Žádná karta nesmí být ve skupině sama
 *   - Žolíci vždy na první místo skupiny, priorita odspodu
 *   - Max. 1 žolík na skupinu
 *
 * Postup:
 *   1. Odděl žolíky od normálních karet
 *   2. Rozděl normální karty do skupin (spodní dostane 3 pokud lichý počet)
 *   3. Vlož žolíky odspodu — jeden do každé skupiny
 *
 * Vrací pole skupin (pole polí) seřazených odspodu nahoru.
 */
function splitIntoGroups(cards) {
  // Krok 1: odděl žolíky
  const jokers  = cards.filter(c => c.rank === "Joker");
  const normals = cards.filter(c => c.rank !== "Joker");

  // Krok 2: rozděl normální karty do skupin
  // Lichý počet → spodní skupina dostane 3 karty
  const groups = [];
  let i = 0;

  if (normals.length % 2 !== 0) {
    // Spodní skupina: první 3 karty
    groups.push(normals.slice(0, 3));
    i = 3;
  }

  // Zbytek po 2
  while (i < normals.length) {
    groups.push(normals.slice(i, i + 2));
    i += 2;
  }

  // Okrajový případ: žádné normální karty (nemělo by nastat, ale pro jistotu)
  if (groups.length === 0 && jokers.length > 0) {
    // Nemůže nastat dle pravidel hry, ale raději nepadneme
    console.warn("splitIntoGroups: only jokers, no normal cards");
    groups.push([]);
  }

  // Krok 3: vlož žolíky odspodu — jeden do každé skupiny
  // jokers[0] → groups[0] (spodní), jokers[1] → groups[1] atd.
  jokers.forEach((joker, idx) => {
    if (idx < groups.length) {
      groups[idx].unshift(joker);  // unshift = vloží na začátek (index 0) skupiny
    }
  });

  return groups;
}


// ── 10. Akce: krádež z bodovacího balíčku ────────────────────────────────

/**
 * stealFromScorePile(thiefIndex, cardId, victimIndex)
 *
 * Postup:
 *   1. Zkontroluj že oběť není v závazku
 *   2. Zkontroluj že oběť má neprázdný scorePile
 *   3. Vezmi vrchní skupinu oběti (scorePile.pop())
 *   4. Urči rank krádeže:
 *      - Karta zloděje není žolík → rank = rank karty zloděje
 *      - Karta zloděje je žolík → rank = rank karet v ukradené skupině
 *   5. Zkontroluj shodu ranku s ukradnou skupinou (nebo žolík pravidlo)
 *   6. Zkontroluj vlastní vrchní skupinu zloděje — stejný rank? → přidej do hromádky
 *   7. Spusť splitIntoGroups() na všechny karty dohromady
 *   8. Přidej výsledné skupiny na scorePile zloděje
 */
function stealFromScorePile(thiefIndex, cardId, victimIndex) {
  const thief  = gameState.players[thiefIndex];
  const victim = gameState.players[victimIndex];

  // Zloděj v závazku nemůže krást
  if (thief.inCommitment) {
    const neededRank = thief.scorePile[thief.scorePile.length - 1][0].rank;
    setStatus(T().commitBlocked(neededRank));
    return false;
  }

  // Oběť nemá co krást
  if (victim.scorePile.length === 0) {
    setStatus(T().cantStealEmpty);
    return false;
  }

  // Oběť je v závazku — osamělá karta není kraditelná
  if (victim.inCommitment) {
    setStatus(T().cantSteal);
    return false;
  }

  const found = findCardInHand(thiefIndex, cardId);
  if (!found) return false;

  const { card: thiefCard, index: thiefIndex2 } = found;
  const stolenGroup = victim.scorePile[victim.scorePile.length - 1];

  // Urči rank krádeže
  const thiefIsJoker  = thiefCard.rank === "Joker";
  const stolenIsJoker = stolenGroup.some(c => c.rank === "Joker");

  // Rank ukradené skupiny = rank první ne-žolíkové karty ve skupině
  const stolenRank = stolenGroup.find(c => c.rank !== "Joker")?.rank;

  // Ověř shodu:
  // - žolík se žolíkem nelze (ukradená skupina by musela být čistě žolíková — nemělo by nastat)
  // - karta zloděje není žolík → musí sedět rank
  if (!thiefIsJoker && thiefCard.rank !== stolenRank) {
    setStatus(T().cantStealRank);
    return false;
  }

  // Žolík krade žolíka — nepřipustné (žolík se žolíkem nelze)
  if (thiefIsJoker && stolenIsJoker && stolenGroup.every(c => c.rank === "Joker")) {
    setStatus(T().cantStealRank);
    return false;
  }

  // ── Krádež proběhne ──

  // Odeber kartu z ruky zloděje
  thief.hand.splice(thiefIndex2, 1);

  // Odeber vrchní skupinu oběti
  victim.scorePile.pop();
  victim.totalScore = calcScore(victim);

  // Urči rank pro porovnání s vlastní skupinou zloděje
  const stealRank = thiefIsJoker ? stolenRank : thiefCard.rank;

  // Zkontroluj vlastní vrchní skupinu zloděje — stejný rank → přidej do hromádky
  let ownGroup = [];
  if (thief.scorePile.length > 0) {
    const topGroup     = thief.scorePile[thief.scorePile.length - 1];
    const topGroupRank = topGroup.find(c => c.rank !== "Joker")?.rank;
    if (topGroupRank === stealRank) {
      ownGroup = thief.scorePile.pop();  // vytáhneme celou skupinu
    }
  }

  // Slož všechny karty dohromady: karta zloděje + ukradená skupina + vlastní skupina
  const allCards = [thiefCard, ...stolenGroup, ...ownGroup];

  // Rozděl algoritmem
  const newGroups = splitIntoGroups(allCards);

  // Přidej výsledné skupiny na scorePile zloděje (odspodu nahoru)
  newGroups.forEach(group => thief.scorePile.push(group));
  thief.totalScore = calcScore(thief);

  setStatus(T().stolen(thief.name, cardLabel(thiefCard)), true);
  return true;
}


// ── 11. Akce: odhoz karty ──────────────────────────────────────────────────

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


// ── 12. Akce: vzít z odhazovacího balíčku ────────────────────────────────

/**
 * takeFromDiscard() – hráč kliknul na odhazovací balíček s vybranou kartou.
 *
 * Pravidla:
 *   - Žolík se žolíkem nelze
 *   - Rank sedí → normální pár
 *   - Jedna strana je žolík → pár
 *   - Jinak → prostý odhoz
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

  // Žolík vždy spodní (první v poli)
  let group;
  if (handJoker) {
    group = [card, topCard];
  } else if (topJoker) {
    group = [topCard, card];
  } else {
    group = [card, topCard];
  }

  player.hand.splice(index, 1);
  gameState.discardPile.pop();
  player.scorePile.push(group);
  player.totalScore = calcScore(player);

  setStatus(T().tookFromDiscard(player.name, cardLabel(card)), true);
  return true;
}


// ── 13. Akce: vyložení na bodovací balíček ────────────────────────────────

function playToScorePile(playerIndex, cardId) {
  const player = gameState.players[playerIndex];
  const found  = findCardInHand(playerIndex, cardId);
  if (!found) return false;

  const { card, index } = found;

  // Případ B: dokládáme druhou kartu závazku
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

  // Případ A: nový závazek — hráč má pár v ruce
  const hasPair = player.hand.some((c, i) => i !== index && c.rank === card.rank);

  if (hasPair) {
    player.hand.splice(index, 1);
    player.scorePile.push([card]);
    player.inCommitment = true;
    player.totalScore   = calcScore(player);

    setStatus(T().commitStart(player.name, cardLabel(card)), true);
    return true;
  }

  // Případ C: přiložení na vlastní vrchní skupinu stejného ranku
  // Podmínky: hráč není v závazku (ošetřeno výše), karta není žolík,
  // vlastní scorePile není prázdný, vrchní skupina má stejný rank.
  if (card.rank !== "Joker" && player.scorePile.length > 0) {
    const topGroup     = player.scorePile[player.scorePile.length - 1];
    const topGroupRank = topGroup.find(c => c.rank !== "Joker")?.rank;

    if (topGroupRank === card.rank) {
      player.hand.splice(index, 1);
      topGroup.push(card);

      // Pokud má skupina 4+ karet → rozděl algoritmem
      // (3 karty jsou ok — spodní skupina může mít max. 3)
      if (topGroup.length >= 4) {
        player.scorePile.pop();                       // vyjmi skupinu
        const newGroups = splitIntoGroups(topGroup);  // rozděl
        newGroups.forEach(g => player.scorePile.push(g)); // vrať zpět
      }

      player.totalScore = calcScore(player);
      setStatus(T().addedToGroup(player.name, cardLabel(card)), true);
      return true;
    }
  }

  // Žádná z možností — karta na vlastní balíček nejde
  setStatus(T().noPair(cardLabel(card)));
  return false;
}


// ── 14. Posun tahu ─────────────────────────────────────────────────────────

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


// ── 15. AI tah ─────────────────────────────────────────────────────────────

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


// ── 16. Systém dvou kliků ─────────────────────────────────────────────────

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
    // Klik na vlastní balíček → vyložení / závazek
    resolveAction("score-self");
  } else {
    // Klik na cizí balíček → krádež
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


// ── 17. Renderování ────────────────────────────────────────────────────────

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

      const wrapper = document.createElement("div");
      wrapper.classList.add("score-group");
      if (isCommitment) wrapper.classList.add("commitment");
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

  // Soupeřův balíček se zvýrazní jako cíl pouze pokud je vybrána karta
  // a soupeř NENÍ v závazku (osamělá karta není kraditelná)
  const opponent2      = gameState.players[1];
  const stealable      = selectedCard !== null
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
