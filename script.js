const board = document.getElementById("board");
const statusText = document.getElementById("status");

const handPlayer = document.getElementById("hand-player");
const handBot = document.getElementById("hand-bot");

const overlay = document.getElementById("overlay");
const resultText = document.getElementById("result-text");

const moveSound = new Audio("sounds/move.mp3");
const errorSound = new Audio("sounds/illegal.mp3");
const captureSound = new Audio("sounds/capture.mp3");

const KANJI = {
  FU:"歩", KY:"香", KE:"桂", GI:"銀", KI:"金",
  KA:"角", HI:"飛", OU:"王",
  TO:"と", NY:"杏", NK:"圭", NG:"全", UM:"馬", RY:"龍"
};

const VALUE = {
  FU:1, KY:3, KE:3, GI:4, KI:5,
  KA:8, HI:9, OU:100,
  TO:5, NY:5, NK:5, NG:5, UM:10, RY:11
};

let turn = "player";

let selected = null;
let selectedHand = null;

let state = Array(81).fill(null);

let hands = {
  player: [],
  bot: []
};

/* =========================
   STARTPOSITION
========================= */

function put(i,t,o){
  state[i] = {
    type:t,
    owner:o
  };
}

for(let i=0;i<9;i++){
  put(18+i,"FU","bot");
  put(54+i,"FU","player");
}

put(0,"KY","bot");
put(8,"KY","bot");

put(72,"KY","player");
put(80,"KY","player");

put(1,"KE","bot");
put(7,"KE","bot");

put(73,"KE","player");
put(79,"KE","player");

put(2,"GI","bot");
put(6,"GI","bot");

put(74,"GI","player");
put(78,"GI","player");

put(3,"KI","bot");
put(5,"KI","bot");

put(75,"KI","player");
put(77,"KI","player");

put(4,"OU","bot");
put(76,"OU","player");

put(16,"KA","bot");
put(64,"KA","player");

put(10,"HI","bot");
put(70,"HI","player");

/* =========================
   BOARD
========================= */

for(let i=0;i<81;i++){
  const square = document.createElement("div");

  square.className = "square";

  square.onclick = () => clickSquare(i);

  board.appendChild(square);
}

/* =========================
   RENDER
========================= */

function render(){

  document.querySelectorAll(".square").forEach((square,i)=>{

    square.innerHTML = "";
    square.classList.remove("selected");

    if(i === selected){
      square.classList.add("selected");
    }

    const piece = state[i];

    if(piece){

      const el = document.createElement("div");

      el.className = "piece";

      if(piece.owner === "bot"){
        el.classList.add("enemy");
      }

      if(piece.promoted){
        el.classList.add("promoted");
      }

      el.textContent = KANJI[piece.type];

      square.appendChild(el);
    }
  });

  renderHands();
}

/* =========================
   HANDS
========================= */

function renderHands(){

  handPlayer.innerHTML = "";

  hands.player.forEach((piece,index)=>{

    const span = document.createElement("span");

    span.textContent = KANJI[piece] + " ";

    span.style.cursor = "pointer";

    span.onclick = () => {
      if(turn !== "player") return;

      selectedHand = {
        type: piece,
        index
      };

      selected = null;

      statusText.textContent =
        "モチゴマ ヲ オク マス ヲ エランデ";
    };

    handPlayer.appendChild(span);
  });

  handBot.textContent =
    hands.bot.map(p=>KANJI[p]).join(" ");
}

/* =========================
   CLICK
========================= */

function clickSquare(i){

  if(turn !== "player") return;

  /* HAND DROP */

  if(selectedHand){

    if(state[i]){
      illegal();
      return;
    }

    state[i] = {
      type:selectedHand.type,
      owner:"player"
    };

    hands.player.splice(selectedHand.index,1);

    selectedHand = null;

    moveSound.play();

    endPlayerTurn();

    return;
  }

  const piece = state[i];

  /* SELECT */

  if(selected === null){

    if(piece && piece.owner === "player"){

      selected = i;

      render();

    } else {

      illegal();
    }

    return;
  }

  /* MOVE */

  if(!legalMove(selected,i)){

    illegal();

    selected = null;

    render();

    return;
  }

  doMove(selected,i,"player");

  selected = null;

  endPlayerTurn();
}

/* =========================
   PLAYER TURN END
========================= */

function endPlayerTurn(){

  render();

  turn = "bot";

  thinking();

  setTimeout(botMove,800);
}

/* =========================
   BOT THINKING
========================= */

let thinkInterval;

function thinking(){

  let dots = 0;

  thinkInterval = setInterval(()=>{

    dots = (dots+1)%4;

    statusText.textContent =
      "考え中" + "・".repeat(dots);

  },300);
}

/* =========================
   BOT
========================= */

function botMove(){

  clearInterval(thinkInterval);

  let bestMove = null;

  let bestScore = -99999;

  for(let from=0; from<81; from++){

    const piece = state[from];

    if(!piece || piece.owner !== "bot") continue;

    for(let to=0; to<81; to++){

      if(!legalMove(from,to)) continue;

      const backupFrom = structuredClone(state[from]);
      const backupTo = structuredClone(state[to]);

      let gain = 0;

      if(state[to]){
        gain = VALUE[state[to].type];
      }

      state[to] = state[from];
      state[from] = null;

      const score = gain + evaluateBoard();

      state[from] = backupFrom;
      state[to] = backupTo;

      if(score > bestScore){

        bestScore = score;

        bestMove = [from,to];
      }
    }
  }

  if(bestMove){

    doMove(bestMove[0],bestMove[1],"bot");
  }

  turn = "player";

  statusText.textContent =
    "プレイヤー ノ ターン";

  render();
}

/* =========================
   MOVE
========================= */

function doMove(from,to,who){

  if(state[to]){

    if(state[to].type === "OU"){

      if(state[to].owner === "bot"){
        winGame();
      } else {
        loseGame();
      }

      return;
    }

    captureSound.play();

    hands[who].push(
      demote(state[to].type)
    );

  } else {

    moveSound.play();
  }

  state[to] = state[from];

  state[from] = null;

  promoteIfPossible(to);
}

/* =========================
   PROMOTION
========================= */

function promoteIfPossible(i){

  const piece = state[i];

  if(!piece) return;

  if(
    ["FU","KY","KE","GI","KA","HI"]
    .includes(piece.type)
  ){

    const playerZone = i < 27;
    const botZone = i > 53;

    if(
      (piece.owner==="player" && playerZone) ||
      (piece.owner==="bot" && botZone)
    ){

      piece.type = {
        FU:"TO",
        KY:"NY",
        KE:"NK",
        GI:"NG",
        KA:"UM",
        HI:"RY"
      }[piece.type];

      piece.promoted = true;
    }
  }
}

/* =========================
   DEMOTE
========================= */

function demote(type){

  return {
    TO:"FU",
    NY:"KY",
    NK:"KE",
    NG:"GI",
    UM:"KA",
    RY:"HI"
  }[type] || type;
}

/* =========================
   PATH CHECK
========================= */

function clearPath(from,to){

  const fx = from % 9;
  const fy = Math.floor(from/9);

  const tx = to % 9;
  const ty = Math.floor(to/9);

  const dx = Math.sign(tx-fx);
  const dy = Math.sign(ty-fy);

  let x = fx + dx;
  let y = fy + dy;

  while(x !== tx || y !== ty){

    if(state[y*9+x]){
      return false;
    }

    x += dx;
    y += dy;
  }

  return true;
}

/* =========================
   RULES
========================= */

function legalMove(from,to){

  const piece = state[from];

  if(!piece) return false;

  if(state[to] && state[to].owner === piece.owner){
    return false;
  }

  const fx = from % 9;
  const fy = Math.floor(from/9);

  const tx = to % 9;
  const ty = Math.floor(to/9);

  const dx = tx - fx;
  const dy = ty - fy;

  const dir =
    piece.owner === "player" ? -1 : 1;

  switch(piece.type){

    case "FU":
      return dx===0 && dy===dir;

    case "KY":
      return dx===0 &&
             dy*dir>0 &&
             clearPath(from,to);

    case "KE":
      return Math.abs(dx)===1 &&
             dy===2*dir;

    case "GI":
      return (
        Math.abs(dx)===1 &&
        Math.abs(dy)===1
      ) || (
        dx===0 &&
        dy===dir
      );

    case "KI":
    case "TO":
    case "NY":
    case "NK":
    case "NG":

      return (
        Math.abs(dx)<=1 &&
        dy*dir>=-1 &&
        !(dy===-dir && Math.abs(dx)===1)
      );

    case "KA":
      return Math.abs(dx)===Math.abs(dy) &&
             clearPath(from,to);

    case "HI":
      return (
        dx===0 || dy===0
      ) && clearPath(from,to);

    case "OU":
      return Math.abs(dx)<=1 &&
             Math.abs(dy)<=1;

    case "UM":
      return (
        (
          Math.abs(dx)===Math.abs(dy)
        &&
          clearPath(from,to)
        )
        ||
        (
          Math.abs(dx)+Math.abs(dy)===1
        )
      );

    case "RY":
      return (
        (
          (dx===0 || dy===0)
          &&
          clearPath(from,to)
        )
        ||
        (
          Math.abs(dx)===1 &&
          Math.abs(dy)===1
        )
      );
  }

  return false;
}

/* =========================
   AI SCORE
========================= */

function evaluateBoard(){

  let score = 0;

  state.forEach(piece=>{

    if(!piece) return;

    const value = VALUE[piece.type];

    score +=
      piece.owner==="bot"
      ? value
      : -value;
  });

  return score;
}

/* =========================
   ILLEGAL
========================= */

function illegal(){

  errorSound.currentTime = 0;

  errorSound.play();

  statusText.textContent =
    "イリーガル ナ ムーブ";
}

/* =========================
   WIN / LOSE
========================= */

function winGame(){

  resultText.textContent = "勝利";

  resultText.className = "win";

  overlay.classList.remove("hidden");
}

function loseGame(){

  resultText.textContent = "敗北";

  resultText.className = "lose";

  overlay.classList.remove("hidden");
}

/* =========================
   START
========================= */

render();