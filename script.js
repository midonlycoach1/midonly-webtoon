const TOTAL_EPISODES = 13;
const EXTENSIONS = ["png","jpg","jpeg","webp"];

const app = document.getElementById("app");
const params = new URLSearchParams(location.search);
const selectedEpisode = Number(params.get("episode") || 0);
let publishConfig = {};

async function loadPublishConfig(){
  try{
    const response = await fetch("./publish.json?v=" + Date.now(), {cache:"no-store"});
    if(!response.ok) throw new Error("publish.json not found");
    publishConfig = await response.json();
  }catch(error){
    console.error(error);
    publishConfig = {};
  }
}

function isPublished(number){
  return publishConfig[String(number)] === true;
}

async function fileExists(url){
  try{
    return (await fetch(url,{cache:"no-store"})).ok;
  }catch{
    return false;
  }
}

async function readTitle(number){
  try{
    const response = await fetch(
      `./episodes/episode${number}/title.txt?v=${Date.now()}`,
      {cache:"no-store"}
    );
    if(response.ok){
      const text = (await response.text()).trim();
      return text || `제${number}화`;
    }
  }catch{}
  return `제${number}화`;
}

async function findImage(number, cut){
  const fileNumber = String(cut).padStart(2,"0");
  for(const extension of EXTENSIONS){
    const url = `./episodes/episode${number}/${fileNumber}.${extension}`;
    if(await fileExists(url)) return url;
  }
  return null;
}

async function episodeReady(number){
  return isPublished(number) && Boolean(await findImage(number,1));
}

async function findPreviousEpisode(number){
  for(let n=number-1;n>=1;n--){
    if(await episodeReady(n)) return n;
  }
  return null;
}

async function findNextEpisode(number){
  for(let n=number+1;n<=TOTAL_EPISODES;n++){
    if(await episodeReady(n)) return n;
  }
  return null;
}

function escapeHtml(text){
  return String(text).replace(/[&<>"']/g, char => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[char]));
}

async function showHome(){
  document.title = "중학생활 꿀팁 웹툰";

  app.innerHTML = `
    <header class="site-head">
      <div class="site-head-inner">중학생활 꿀팁 웹툰</div>
    </header>
    <main class="home">
      <h1>웹툰 회차</h1>
      <p>공개된 회차만 표시됩니다.</p>
      <section id="episodeList" class="episode-list"></section>
    </main>
  `;

  const list = document.getElementById("episodeList");
  let count = 0;

  for(let number=1;number<=TOTAL_EPISODES;number++){
    if(!isPublished(number)) continue;

    const thumbnail = await findImage(number,1);
    if(!thumbnail) continue;

    const title = await readTitle(number);
    const card = document.createElement("a");
    card.className = "episode-card";
    card.href = `?episode=${number}`;
    card.innerHTML = `
      <img class="thumb" src="${thumbnail}" alt="${number}화 썸네일">
      <div class="episode-meta">
        <div class="episode-no">제${number}화</div>
        <div class="episode-title">${escapeHtml(title)}</div>
        <div class="episode-state">지금 보기</div>
      </div>
    `;
    list.appendChild(card);
    count++;
  }

  if(count === 0){
    list.innerHTML = `
      <div class="empty">
        공개된 회차가 없거나 첫 번째 이미지 파일을 찾지 못했습니다.
      </div>
    `;
  }
}

async function showViewer(number){
  if(number<1 || number>TOTAL_EPISODES || !isPublished(number)){
    location.href="./";
    return;
  }

  const images=[];
  for(let cut=1;cut<=300;cut++){
    const image = await findImage(number,cut);
    if(!image) break;
    images.push(image);
  }

  if(images.length===0){
    location.href="./";
    return;
  }

  const title = await readTitle(number);
  const previousEpisode = await findPreviousEpisode(number);
  const nextEpisode = await findNextEpisode(number);

  let current = 0; // URL로 다시 들어오면 항상 첫 컷
  let mode = localStorage.getItem("webtoon-view-mode") || "card";

  document.title = `제${number}화 ${title}`;

  app.innerHTML = `
    <div class="viewer">
      <header class="viewer-head">
        <div class="viewer-bar">
          <a class="back" href="./">← 목록</a>

          <div class="viewer-title">
            <span class="title-full">제${number}화 · ${escapeHtml(title)}</span>
            <span class="title-short">제${number}화</span>
          </div>

          <div class="controls">
            <button id="cardMode" class="mode">컷 보기</button>
            <button id="scrollMode" class="mode">세로 보기</button>
          </div>
        </div>
        <div id="progress" class="progress"></div>
      </header>

      <main id="stage" class="stage"></main>

      <div id="bottomNav" class="bottom-nav">
        <button id="previousCut">← 이전 컷</button>
        <button id="nextCut">다음 컷 →</button>
      </div>

      <div id="episodeNav" class="episode-nav">
        ${
          previousEpisode
          ? `<a href="?episode=${previousEpisode}">← 이전화</a>`
          : `<a href="./">← 목록</a>`
        }
        <a href="./">목록</a>
        ${
          nextEpisode
          ? `<a href="?episode=${nextEpisode}">다음화 →</a>`
          : `<a href="./">마지막 화</a>`
        }
      </div>
    </div>

    <div id="leftTap" class="tap-zone left"></div>
    <div id="rightTap" class="tap-zone right"></div>
  `;

  const stage = document.getElementById("stage");
  const progress = document.getElementById("progress");
  const bottomNav = document.getElementById("bottomNav");
  const episodeNav = document.getElementById("episodeNav");
  const previousCutButton = document.getElementById("previousCut");
  const nextCutButton = document.getElementById("nextCut");
  const cardModeButton = document.getElementById("cardMode");
  const scrollModeButton = document.getElementById("scrollMode");

  function jumpTop(){
    window.scrollTo(0,0);
  }

  function render(){
    cardModeButton.classList.toggle("active", mode==="card");
    scrollModeButton.classList.toggle("active", mode==="scroll");

    if(mode==="card"){
      stage.className="stage";
      stage.innerHTML=`
        <img class="card-img" src="${images[current]}" alt="${current+1}번째 컷">
      `;
      progress.textContent=`${current+1} / ${images.length}`;
      bottomNav.style.display="flex";
      previousCutButton.disabled=current===0;
      nextCutButton.disabled=current===images.length-1;
      episodeNav.classList.toggle("show", current===images.length-1);
    }else{
      stage.className="stage scroll";
      stage.innerHTML=images.map((url,index)=>`
        <img src="${url}" alt="${index+1}번째 컷" loading="${index<2?"eager":"lazy"}">
      `).join("");
      progress.textContent=`총 ${images.length}컷`;
      bottomNav.style.display="none";
      episodeNav.classList.add("show");
    }
  }

  function goPreviousCut(){
    if(mode==="card" && current>0){
      current--;
      render();
      jumpTop();
    }
  }

  function goNextCut(){
    if(mode==="card" && current<images.length-1){
      current++;
      render();
      jumpTop();
    }
  }

  previousCutButton.onclick=goPreviousCut;
  nextCutButton.onclick=goNextCut;
  document.getElementById("leftTap").onclick=goPreviousCut;
  document.getElementById("rightTap").onclick=goNextCut;

  cardModeButton.onclick=()=>{
    mode="card";
    localStorage.setItem("webtoon-view-mode",mode);
    render();
    jumpTop();
  };

  scrollModeButton.onclick=()=>{
    mode="scroll";
    localStorage.setItem("webtoon-view-mode",mode);
    render();
    jumpTop();
  };

  let startX=0;
  stage.addEventListener("touchstart",event=>{
    startX=event.changedTouches[0].screenX;
  },{passive:true});

  stage.addEventListener("touchend",event=>{
    if(mode!=="card") return;
    const distance=event.changedTouches[0].screenX-startX;
    if(Math.abs(distance)>45){
      distance<0 ? goNextCut() : goPreviousCut();
    }
  },{passive:true});

  render();
  jumpTop();
}

(async function start(){
  await loadPublishConfig();
  if(selectedEpisode){
    await showViewer(selectedEpisode);
  }else{
    await showHome();
  }
})();
