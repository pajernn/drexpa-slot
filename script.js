"use strict";

/*************************************************
 *
 * Drexpa Prize Machine Engine
 * Version 2.0
 *
 *************************************************/

const WEBAPP_URL =
"https://script.google.com/macros/s/AKfycbxwyh1QIEsp1x4t3FjxfDI-FoBJDS4atEfR2-HKcxKbmzIzKlB6mglflHApzfEdY-PM/exec";

const PrizeMachine={

    version:"2.0",

    initialized:false,

    spinning:false,

    state:"IDLE",

    animationFrame:null,

    lastFrame:0,

    currentPosition:0,

    currentSpeed:0,

    targetPosition:0,

    targetPrize:null,

    prizes:[],

    settings:{},

    images:new Map(),

    dom:{},

    callbacks:{},
resetTimer:null,

};


// HANGOK

PrizeMachine.audio = {

    spin: new Audio("sounds/spin.mp3"),

    winner: new Audio("sounds/winner.mp3"),

    fail: new Audio("sounds/fail.mp3")

};

/*************************************************
 *
 * IMAGE MANAGER
 *
 *************************************************/

PrizeMachine.preloadImages = async function(){

    this.log("Képek ellenőrzése...");

    this.images.clear();

    for(const prize of this.prizes){

        this.images.set(
            prize.id,
            {
                src: prize.image
            }
        );

    }

    this.log(
        this.images.size,
        "kép előkészítve"
    );

};

/*************************************************
 *
 * REEL BUILDER
 *
 *************************************************/

PrizeMachine.clearTrack=function(){

    this.dom.slotTrack.innerHTML="";

}


PrizeMachine.createImage=function(prize){

    const img=document.createElement("img");

    img.className="slotImage";

    const cached=this.images.get(prize.id);

    if(cached){

        img.src=cached.src;

    }

    img.draggable=false;

    img.alt=prize.name;

    return img;

}


PrizeMachine.buildReel=function(){

    this.clearTrack();

    const repeat=
        Number(this.settings.repeatCount);

    for(let r=0;r<repeat;r++){

        for(const prize of this.prizes){

            const image=
                this.createImage(prize);

            image.dataset.id=
                prize.id;

            image.dataset.name=
                prize.name;

            this.dom.slotTrack
                .appendChild(image);

        }

    }

    this.totalItems=
        this.dom.slotTrack.children.length;

    this.itemSize=
        Number(this.settings.itemWidth)+
        Number(this.settings.itemGap);

    this.trackLength=
        this.itemSize*
        this.totalItems;

    this.loopLength=
        this.itemSize*
        this.prizes.length;

    this.currentPosition=0;

    this.updateTrack();

    this.log(
        "Track:",
        this.totalItems,
        "elem"
    );

};


/*************************************************
 *
 * TRACK UPDATE
 *
 *************************************************/

PrizeMachine.updateTrack = function(){

    const drawPosition =
        this.currentPosition % this.loopLength;

    this.dom.slotTrack.style.transform =
        `translate3d(${-drawPosition}px,0,0)`;

}


/*************************************************
 *
 * LOOP ENGINE
 *
 *************************************************/

PrizeMachine.normalize=function(){

    while(
        this.currentPosition>=
        this.loopLength
    ){

        this.currentPosition-=
            this.loopLength;

    }

    while(
        this.currentPosition<0
    ){

        this.currentPosition+=
            this.loopLength;

    }

}


/*************************************************
 *
 * ANIMATION
 *
 *************************************************/

PrizeMachine.animate=(time)=>{

    if(!PrizeMachine.spinning){

        PrizeMachine.animationFrame=null;

        return;

    }

    if(!PrizeMachine.lastFrame){

        PrizeMachine.lastFrame=time;

    }

    const delta =
        (time-PrizeMachine.lastFrame) /
        16.6667;

    PrizeMachine.lastFrame=time;


    PrizeMachine.updateSpin(
        time,
        delta
    );


    if(
        PrizeMachine.state === PrizeMachine.STATE.FINISHED
    ){

        PrizeMachine.finish();

        return;

    }

    PrizeMachine.normalize();

PrizeMachine.updateTrack();


    PrizeMachine.animationFrame =
        requestAnimationFrame(
            PrizeMachine.animate
        );

};

/*************************************************
 *
 * START
 *
 *************************************************/

PrizeMachine.startAnimation = function(){

    this.spinning = true;
    this.lastFrame = 0;

    this.animationFrame =
        requestAnimationFrame(this.animate);

}

PrizeMachine.stopAnimation=function(){

    this.spinning=false;

    cancelAnimationFrame(
        this.animationFrame
    );

}
/*************************************************
 *
 * SPIN ENGINE
 *
 *************************************************/

PrizeMachine.STATE = {

    IDLE: 0,

    ACCELERATING: 1,

    FULL_SPEED: 2,

    DECELERATING: 3,

    FINISHED: 4

};

PrizeMachine.state = PrizeMachine.STATE.IDLE;

PrizeMachine.accelerationStart = 0;

PrizeMachine.fullSpeedStart = 0;

PrizeMachine.decelerationStart = 0;

PrizeMachine.startPosition = 0;

PrizeMachine.targetPosition = 0;

PrizeMachine.spinResolve = null;


/*************************************************
 *
 * STATE
 *
 *************************************************/

PrizeMachine.setState = function(state){

    this.state = state;

    this.log("STATE:", state);

}

PrizeMachine.canSpin = function(){

    return this.state === this.STATE.IDLE;

}


/*************************************************
 *
 * SPIN
 *
 *************************************************/

PrizeMachine.spin = function(prizeId){

    if(!this.initialized){

        throw new Error("Motor nincs inicializálva.");

    }


    // előző eredmény effekt törlése
    this.dom.centerFrame.classList.remove("winner");
this.dom.centerFrame.classList.remove("fail");
clearTimeout(this.resetTimer);

this.dom.gameButtons.style.display = "none";


if(!this.canSpin()){

    return Promise.reject("Már pörög.");

}


this.audio.spin.currentTime = 0;

this.audio.spin.play();

    this.targetPrize = this.prizes.find(
        p => Number(p.id) === Number(prizeId)
    );

    if(!this.targetPrize){

        throw new Error("Hibás Prize ID.");

    }

    this.currentSpeed = 0;

    this.startPosition = this.currentPosition;

    this.accelerationStart = performance.now();

    this.setState(
        this.STATE.ACCELERATING
    );

    this.startAnimation();

    return new Promise(resolve=>{

        this.spinResolve = resolve;

    });

}


/*************************************************
 *
 * UPDATE SPIN
 *
 *************************************************/

PrizeMachine.updateSpin = function(time,delta){

    switch(this.state){

        case this.STATE.ACCELERATING:
            this.updateAcceleration(time,delta);
            break;

        case this.STATE.FULL_SPEED:
            this.updateFullSpeed(time,delta);
            break;

        case this.STATE.DECELERATING:
            this.updateDeceleration(time,delta);
            break;

        case this.STATE.FINISHED:
            this.finish();
            break;

    }

}

/*************************************************
 *
 * ACCELERATION
 *
 *************************************************/

PrizeMachine.updateAcceleration=function(time,delta){

    const progress = Math.min(

        1,

        (time-this.accelerationStart)

        / this.settings.acceleration

    );

    const eased =

        1-Math.pow(1-progress,3);

    this.currentSpeed =

        this.settings.maxSpeed

        * eased;

    this.currentPosition +=

        this.currentSpeed

        * delta;

    if(progress>=1){

        this.currentSpeed=

            this.settings.maxSpeed;

        this.fullSpeedStart=

            performance.now();

        this.setState(

            this.STATE.FULL_SPEED

        );

    }

}


/*************************************************
 *
 * FULL SPEED
 *
 *************************************************/

PrizeMachine.updateFullSpeed=function(time,delta){

    this.currentPosition+=

        this.settings.maxSpeed

        * delta;

    if(

        time-this.fullSpeedStart

        >=

        this.settings.spinDuration

    ){

        this.calculateTargetPosition();
console.log(
    "FULL_SPEED -> DECELERATION",
    "current:", this.currentPosition,
    "target:", this.targetPosition,
    "distance:", this.targetPosition - this.currentPosition
);

        this.decelerationStart=

            performance.now();

        this.startPosition=

            this.currentPosition;

        this.setState(

            this.STATE.DECELERATING

        );

    }

}

/*************************************************
 *
 * TARGET POSITION
 *
 *************************************************/

PrizeMachine.calculateTargetPosition = function(){

    const itemSize =
        this.settings.itemWidth +
        this.settings.itemGap;

    const loopLength =
        this.prizes.length * itemSize;

    const frameCenter =
    this.dom.centerFrame.offsetLeft +
    (this.dom.centerFrame.offsetWidth / 2);

    const indexes = [];

    this.prizes.forEach((p,index)=>{

        if(Number(p.id)===Number(this.targetPrize.id)){

            indexes.push(index);

        }

    });

    if(indexes.length===0){

        throw new Error("Target nem található.");

    }

    let bestPosition = null;

    let bestDistance = Number.MAX_SAFE_INTEGER;

    indexes.forEach(index=>{

        let pos =
            index * itemSize;

        while(pos<=this.currentPosition){

            pos += loopLength;

        }

        pos += loopLength * 2;

const target =
    pos -
    frameCenter +
    (this.settings.itemWidth / 2)
    + 150;

const distance =
    target - this.currentPosition;

        if(distance<bestDistance){

            bestDistance = distance;

            bestPosition = target;

        }

    });

    this.targetPosition =
        bestPosition;
console.log(
    "calculateTargetPosition",
    "current:", this.currentPosition,
    "target:", this.targetPosition,
    "distance:", this.targetPosition - this.currentPosition
);

}


/*************************************************
 *
 * DECELERATION
 *
 *************************************************/

PrizeMachine.updateDeceleration = function(time, delta){

    const progress = Math.min(

        1,

        (time - this.decelerationStart)

        /

        this.settings.deceleration

    );

    console.log(
        "DECEL",
        "progress:", progress.toFixed(3),
        "current:", this.currentPosition,
        "target:", this.targetPosition
    );

    const eased =
        1 - Math.pow(1 - progress, 3);

    this.currentPosition =

        this.startPosition +

        (

            this.targetPosition -

            this.startPosition

        )

        *

        eased;

    if(progress>=1){

        this.currentPosition =
            this.targetPosition;

        this.currentSpeed = 0;

        this.setState(
            this.STATE.FINISHED
        );

    }

}
/*************************************************
 *
 * FINISH
 *
 *************************************************/
PrizeMachine.finish=function(){

    // végső pozíció rögzítése
    this.currentPosition = this.targetPosition;

    this.updateTrack();

    this.stopAnimation();

    this.state =
        this.STATE.IDLE;
this.dom.centerFrame.classList.remove("winner");
this.dom.centerFrame.classList.remove("fail");


if(Number(this.targetPrize.id) === 0){
    // NEM NYERT
    this.dom.centerFrame.classList.add("fail");

    this.audio.fail.currentTime = 0;
    this.audio.fail.play();

    this.dom.resultTitle.innerHTML =
        "😢 MOST NEM NYERTÉL";

}
else{

    // NYERT
    this.dom.centerFrame.classList.add("winner");

    this.audio.winner.currentTime = 0;
    this.audio.winner.play();

    this.dom.resultTitle.innerHTML =
        "🎉 NYERTÉL! Nyereményed: 🎉";
this.startConfetti();

}

    this.dom.resultPrize.innerHTML =
        this.targetPrize.name;

    if(this.spinResolve){

        this.spinResolve(
            this.targetPrize
        );

        this.spinResolve=null;

    }

    if(
        window.AppInventor &&
        window.AppInventor.setWebViewString
    ){

        window.AppInventor
        .setWebViewString(

            JSON.stringify({

                event:"winner",

                id:this.targetPrize.id,

                name:this.targetPrize.name

            })

        );

    }

    this.log(
        "Winner:",
        this.targetPrize
    );
this.dom.gameButtons.style.display = "none";

setTimeout(() => {

    this.dom.gameButtons.style.display = "flex";

}, 3000);
clearTimeout(this.resetTimer);

this.resetTimer = setTimeout(()=>{

    if(
        window.AppInventor &&
        window.AppInventor.setWebViewString
    ){
        window.AppInventor.setWebViewString("BACK");
    } else {
        this.resetGame();
    }

},15000);
}
/*************************************************
 *
 * STOP
 *
 *************************************************/

PrizeMachine.stop=function(){

    this.stopAnimation();

    this.currentSpeed=0;

    this.state=this.STATE.IDLE;

}


/*************************************************
 *
 * RESET
 *
 *************************************************/

PrizeMachine.reset=function(){

    this.stop();

    this.currentPosition=0;

    this.targetPosition=0;

    this.targetPrize=null;

    this.updateTrack();

    this.dom.resultTitle.innerHTML="";

    this.dom.resultPrize.innerHTML="";

}


/*************************************************
 *
 * RELOAD
 *
 *************************************************/

PrizeMachine.reload=async function(){

    this.reset();

    await this.load();

this.applySettings();

await this.preloadImages();

    this.buildReel();

}


/*************************************************
 *
 * CALLBACKS
 *
 *************************************************/

PrizeMachine.on=function(event,callback){

    this.callbacks[event]=callback;

}


PrizeMachine.emit=function(event,data){

    if(typeof this.callbacks[event]==="function"){

        this.callbacks[event](data);

    }

}


/*************************************************
 *
 * APP INVENTOR
 *
 *************************************************/

window.spinPrize=function(id){

    return PrizeMachine.spin(id);

}

window.reloadMachine=function(){

    return PrizeMachine.reload();

}

window.stopMachine=function(){

    PrizeMachine.stop();

}


/*************************************************
 *
 * INIT
 *
 *************************************************/
window.addEventListener("load", async () => {

    try {

        await PrizeMachine.init();

        console.log("PrizeMachine READY");

        document.getElementById("slotContainer").style.opacity = "1";

        if (
            window.AppInventor &&
            window.AppInventor.setWebViewString
        ){
            window.AppInventor.setWebViewString("READY");
        }

    }

    catch(e){

        console.error(e);

    }

});
/*************************************************
 *
 * SETTINGS MANAGER
 *
 *************************************************/

PrizeMachine.applySettings = function () {

    const s = this.settings;

    // Pörgetési beállítások
    this.settings.repeatCount = Number(s.repeatCount || 8);
    this.settings.itemWidth = Number(s.itemWidth || 180);
    this.settings.itemGap = Number(s.itemGap || 30);
    this.settings.maxSpeed = Number(s.maxSpeed || 45);
    this.settings.acceleration = Number(s.acceleration || 700);
    this.settings.deceleration = Number(s.deceleration || 2000);
    this.settings.spinDuration = Number(s.spinDuration || 6000);

    // Háttér
    if (s.backgroundImage) {

        document.body.style.backgroundImage =
            "url('" + s.backgroundImage + "')";

        document.body.style.backgroundSize = "cover";
        document.body.style.backgroundPosition = "center";

    }

    // Logó
    if (s.logoImage) {

        const logo = document.getElementById("logo");

        if (logo) {
            logo.src = s.logoImage;
        }

    }

    // Középső keret
    if (s.frameColor) {

        const frame = this.dom.centerFrame;

        frame.style.borderColor = s.frameColor;

    }

    if (s.frameGlow) {

        const frame = this.dom.centerFrame;

        frame.style.boxShadow =
            `
            0 0 15px ${s.frameGlow},
            0 0 35px ${s.frameGlow},
            0 0 60px ${s.frameGlow}
            `;

    }

    // Szövegek
    if (s.titleColor) {

        this.dom.resultTitle.style.color =
            s.titleColor;

    }

    if (s.winnerColor) {

        this.dom.resultPrize.style.color =
            s.winnerColor;

    }

    this.log("Beállítások alkalmazva.");

};
/*************************************************
 *
 * LOG
 *
 *************************************************/

PrizeMachine.log = function (...args) {

    console.log("[PrizeMachine]", ...args);

};


/*************************************************
 *
 * DOM
 *
 *************************************************/

PrizeMachine.initDOM = function () {

    this.dom.slotContainer = document.getElementById("slotContainer");
    this.dom.slotTrack = document.getElementById("slotTrack");
    this.dom.centerFrame = document.getElementById("centerFrame");

    this.dom.resultTitle = document.getElementById("resultTitle");
    this.dom.resultPrize = document.getElementById("resultPrize");
this.dom.gameButtons =
document.getElementById("gameButtons");

this.dom.newCodeBtn =
document.getElementById("newCodeBtn");

};


/*************************************************
 *
 * LOAD
 *
 *************************************************/

PrizeMachine.load = async function () {

    this.log("API betöltés...");

    const response = await fetch(
        WEBAPP_URL + "?action=init",
        {
            cache: "no-store"
        }
    );

    const json = await response.json();

    if (json.status !== "OK") {

        throw new Error(json.message);

    }

    this.settings = json.data.settings;
    this.prizes = json.data.prizes;

};


/*************************************************
 *
 * INIT
 *
 *************************************************/

PrizeMachine.init = async function () {

    this.initDOM();

    await this.load();

    this.applySettings();

    await this.preloadImages();

   this.buildReel();

this.dom.newCodeBtn.onclick = ()=>{

    if(
        window.AppInventor &&
        window.AppInventor.setWebViewString
    ){
        window.AppInventor.setWebViewString("BACK");
    }

    this.resetGame();

};

    this.initialized = true;

    this.log("READY");

};
PrizeMachine.startConfetti = function(){

    const container =
        document.getElementById("confetti");


    if(!container) return;


    container.innerHTML = "";


    for(let i=0;i<80;i++){


        const piece =
            document.createElement("div");


        piece.style.position="absolute";

        piece.style.width="10px";

        piece.style.height="10px";

        piece.style.left =
            Math.random()*100+"%";


        piece.style.top="-20px";


        piece.style.background =
            [
              "#ff0000",
              "#00ff00",
              "#0088ff",
              "#ffd700",
              "#ff00ff"
            ][
              Math.floor(Math.random()*5)
            ];


        piece.style.transform =
            "rotate("+
            Math.random()*360+
            "deg)";


        piece.style.animation =
            "confettiFall "+
            (2+Math.random()*2)+"s linear";


        container.appendChild(piece);

    }


    setTimeout(()=>{

        container.innerHTML="";

    },5000);

};
/*************************************************
 *
 * RESET GAME
 *
 *************************************************/

PrizeMachine.resetGame=function(){

    clearTimeout(this.resetTimer);

    this.dom.gameButtons.style.display="none";

    this.dom.resultTitle.innerHTML="";

    this.dom.resultPrize.innerHTML="";

    this.dom.centerFrame.classList.remove("winner");
    this.dom.centerFrame.classList.remove("fail");

    // Konfetti törlése
    const confetti =
        document.getElementById("confetti");

    if(confetti){

        confetti.innerHTML="";

    }

    // App Inventor értesítése
    if(
        window.AppInventor &&
        window.AppInventor.setWebViewString
    ){

        window.AppInventor.setWebViewString("BACK");

    }

}
/*************************************************
 *
 * APP INVENTOR INDÍTÁS
 *
 *************************************************/

window.startSlot = function(prizeId){

    console.log("startSlot meghívva:", prizeId, typeof prizeId);

    if(!PrizeMachine.initialized){
        console.log("A nyerőgép még nem áll készen.");
        return false;
    }

    document.getElementById("slotContainer").style.opacity = "1";

    PrizeMachine.spin(Number(prizeId));

    return true;

};