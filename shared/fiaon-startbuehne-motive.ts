// Privat: ERZEUGT von scratchpad/lader/motive.py aus dem Entwurf privat-p1b. Business: seit E-461 (29.10.2026) „Flüssiges Glas“ (unten).
// Die Motive der Startbühne (E-287): Justin wählte am 06.10.2026 „Riffelglas“ (Privat) und „Fassade“ (Business), am 29.10.2026 „Flüssiges Glas“ (Business).
// Nicht von Hand ändern — Fragment ändern, Werkbank (bau.mjs) prüfen, neu erzeugen.
/* eslint-disable */
import { MARKE_PFAD } from "./fiaon-marke";

export interface BuehnenMotiv {
  /** Werkbank-Entwurf, aus dem das Motiv stammt. */
  quelle: string;
  /** Wurzelklasse; alle Regeln im Stil sind darunter eingeschlossen, die Ausblendung hängt an „.weg“. */
  klasse: string;
  aria: string;
  /** Kleinste Standzeit ab Aufruf, damit der Auftakt nicht abreißt. */
  mindestensMs: number;
  stil: string;
  innen: string;
}

export const MOTIV_PRIVAT: BuehnenMotiv = {
  quelle: "privat-p1b",
  klasse: "x-p1b",
  aria: "FIAON lädt",
  mindestensMs: 1250,
  stil: `.x-p1b{position:fixed;inset:0;z-index:10;overflow:hidden;--mw:min(70vw,470px,90vmin);--mh:calc(var(--mw)*.2361)}
@media (orientation:portrait){.x-p1b{--mw:min(78vw,470px)}}
.x-p1b::before{content:"";position:absolute;inset:0;background:#0f1730}
.x-p1b>i{position:absolute;top:0;bottom:0;left:calc(var(--i)*100%/32);width:calc(100%/32);overflow:hidden;z-index:0;background:radial-gradient(ellipse 30% 34% at 50% 50%,rgba(37,99,235,.2),transparent),linear-gradient(135deg,#0a1628 0%,#121a33 50%,#0b0f24 100%);background-size:3200% 100%;background-position:calc(var(--i)*100%/31) 0}
.x-p1b>i::before,.x-p1b>i::after{content:"";position:absolute;inset:0;z-index:1}
.x-p1b>i::after{background:linear-gradient(90deg,rgba(191,219,254,.2) 0,rgba(191,219,254,.06) 2px,transparent 42%,rgba(3,7,20,.34) 100%);opacity:.38;animation:p1b-klar 1s ease-in-out calc(.45s + var(--d)*16ms) both}
@keyframes p1b-klar{from{opacity:1}}
.x-p1b>i::before{background:radial-gradient(ellipse 140% 40% at 0 50%,rgba(147,197,253,.42),transparent 72%);opacity:0;animation:p1b-licht 1.1s ease-out calc(.04s + var(--d)*24ms) both,p1b-welle 6s ease-in-out calc(1.9s + var(--i)*75ms) infinite}
@keyframes p1b-licht{0%{opacity:0}22%{opacity:1}}
@keyframes p1b-welle{12%{opacity:.5}30%{opacity:0}}
.x-p1b b{position:absolute;z-index:2;left:0;width:100%;top:calc(50% - var(--mh)*1.5);height:calc(var(--mh)*3);animation:p1b-bild .85s cubic-bezier(.3,.1,.1,1) calc(.2s + var(--d)*13ms) both}
.x-p1b b::before{content:"";position:absolute;top:0;height:100%;width:calc(var(--mw)*1.5);left:calc(1600% - var(--mw)*.75 - var(--i)*100%);background:radial-gradient(closest-side,rgba(59,130,246,.42),rgba(37,99,235,.14) 55%,transparent)}
@keyframes p1b-bild{from{transform:scaleX(.6);opacity:0}30%{opacity:1}}
.x-p1b svg{position:absolute;width:var(--mw);height:var(--mh);fill:#fff}
.x-p1b b svg{top:var(--mh);left:calc(1600% - var(--mw)/2 - var(--i)*100%)}
@media (min-width:940px){.x-p1b .r svg{display:none}}
.x-p1b .dv{width:0;height:0}
.x-p1b .ganz{z-index:3;left:50%;top:50%;margin:calc(var(--mh)*-.5) 0 0 calc(var(--mw)*-.5);animation:p1b-da .25s linear .95s both}
@keyframes p1b-da{from{opacity:0}}
.x-p1b.weg{pointer-events:none;animation:p1b-ende .8s linear both}
.x-p1b.weg .ganz,.x-p1b.weg b{animation:p1b-hinter .18s ease-in both}
.x-p1b.weg::before{animation:p1b-hinter .36s ease-in .22s both}
.x-p1b.weg>i{animation:p1b-dreh .5s cubic-bezier(.55,0,.3,1) calc(var(--d)*15ms) both}
.x-p1b.weg>i::after{animation:p1b-kante .5s ease-in calc(var(--d)*15ms) both}
.x-p1b.weg>i::before{animation:p1b-blitz .5s ease-out calc(var(--d)*15ms) both}
@keyframes p1b-hinter{to{opacity:0}}
@keyframes p1b-dreh{to{transform:perspective(600px) rotateY(90deg)}}
@keyframes p1b-kante{to{opacity:1}}
@keyframes p1b-blitz{50%{opacity:.7}100%{opacity:.4}}
@keyframes p1b-ende{0%,95%{opacity:1}100%{opacity:0}}
@media (prefers-reduced-motion:reduce){
.x-p1b *,.x-p1b>i::before,.x-p1b>i::after{animation:none!important}
.x-p1b.weg{animation:p1b-blende .5s ease both}
@keyframes p1b-blende{to{opacity:0}}
}`,
  innen: `<svg class="dv" aria-hidden="true"><defs><symbol id="p1b-m" viewBox="31 -722 3117 736"><path d="${MARKE_PFAD.fiaon}"/></symbol></defs></svg>
<i style="--i:0;--d:15.5"><b></b></i>
<i style="--i:1;--d:14.5"><b></b></i>
<i style="--i:2;--d:13.5"><b></b></i>
<i class="r" style="--i:3;--d:12.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i class="r" style="--i:4;--d:11.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i class="r" style="--i:5;--d:10.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i class="r" style="--i:6;--d:9.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i class="r" style="--i:7;--d:8.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:8;--d:7.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:9;--d:6.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:10;--d:5.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:11;--d:4.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:12;--d:3.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:13;--d:2.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:14;--d:1.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:15;--d:0.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:16;--d:0.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:17;--d:1.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:18;--d:2.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:19;--d:3.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:20;--d:4.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:21;--d:5.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:22;--d:6.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:23;--d:7.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i class="r" style="--i:24;--d:8.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i class="r" style="--i:25;--d:9.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i class="r" style="--i:26;--d:10.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i class="r" style="--i:27;--d:11.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i class="r" style="--i:28;--d:12.5"><b><svg><use href="#p1b-m"/></svg></b></i>
<i style="--i:29;--d:13.5"><b></b></i>
<i style="--i:30;--d:14.5"><b></b></i>
<i style="--i:31;--d:15.5"><b></b></i>
<svg class="ganz" aria-hidden="true"><use href="#p1b-m"/></svg>`,
};

// 29.10.2026 (E-461): Justin wählte in Runde 2 (Sitzung „FIAON ENTWICKLUNG (TFO)“) „Flüssiges Glas“ — „Flüssiges Glas also A“.
// Ersetzt „Fassade“ (business-b3b, 06.10.). Quelle: 10_Nacharbeit/2026-10-29_Business_Lader/runde2/lader-A-fluessiges-glas.html
// (reines CSS + SVG mit dem Logo, kein Skript). Eingesetzt wie geliefert; einzige Änderung: Wurzel position:fixed + z-index:10
// wie MOTIV_PRIVAT, damit derselbe Lader beim Seitenwechsel (App.tsx, SeiteLaedt) das Fenster füllt. Auftritt 1,6 s,
// danach gleitet alle 3,6 s Licht durchs Glas; Ausgang über „.weg“ (0,5 s); weniger Bewegung = sofort das Endbild.
export const MOTIV_BUSINESS: BuehnenMotiv = {
  quelle: "runde2-fluessiges-glas",
  klasse: "lw-a",
  aria: "FIAON Global lädt",
  mindestensMs: 1600,
  stil: `.lw-a{position:fixed;inset:0;z-index:10;overflow:hidden;contain:strict;--w:clamp(264px,72vmin,520px);--h:calc(var(--w)*.34);--x0:-212}
@media (min-aspect-ratio:4/3){.lw-a{--x0:-262}}
@media (max-width:340px){.lw-a{--x0:-196}}
.lw-a i,.lw-a .lw-a-r,.lw-a .lw-a-s,.lw-a .lw-a-in,.lw-a .lw-a-ob,.lw-a .lw-a-ra,.lw-a .lw-a-gw,.lw-a .lw-a-lg{position:absolute;display:block}
.lw-a-bg{inset:0;background:radial-gradient(120% 80% at 50% 42%,#f9fbff,#f3f7fe 28%,#eef3fc 55%,#e8eef9 80%,#e3eaf7)}
.lw-a-r{left:50%;top:48.5%;animation:lw-a-ca 1.6s cubic-bezier(.3,.1,.2,1) both}
@keyframes lw-a-ca{0%{transform:scale(.93)}100%{transform:none}}
.lw-a-am{left:calc(var(--w)*-.8);top:calc(var(--w)*-.5);width:calc(var(--w)*1.6);height:var(--w);background:radial-gradient(closest-side,#3a8bff33,#3a8bff26 24%,#3a8bff16 48%,#3a8bff08 72%,#3a8bff00);opacity:.7;animation:lw-a-am 1.6s cubic-bezier(.22,1,.36,1) both}
@keyframes lw-a-am{0%,31%{opacity:0;transform:scale(.4)}50%{opacity:1;transform:scale(1.05);animation-timing-function:cubic-bezier(.45,0,.3,1)}100%{opacity:.7;transform:none}}
.lw-a-s{left:calc(var(--w)*-1.2);top:calc(var(--w)*-.6);width:calc(var(--w)*2.4);height:calc(var(--w)*1.2);overflow:visible;animation:lw-a-sf 1.6s cubic-bezier(.25,.6,.3,1) both}
@keyframes lw-a-sf{0%{opacity:0;filter:blur(7px)}9%{opacity:1}30%,100%{filter:none}}
.lw-a-ts,.lw-a-k,.lw-a-dr{transform-box:fill-box;transform-origin:50% 50%}
.lw-a-dr{animation:lw-a-dr 1.6s cubic-bezier(.25,.7,.35,1) both}
@keyframes lw-a-dr{0%{transform:rotate(-11deg)}36%{transform:rotate(.7deg);animation-timing-function:ease-in-out}54%,100%{transform:none}}
.lw-a-tx{transform:translate(-132px);animation:lw-a-tx 1.6s both}
@keyframes lw-a-tx{0%{transform:translate(calc(var(--x0)*1px));animation-timing-function:cubic-bezier(.45,0,.78,.38)}31%{transform:translate(-64px);animation-timing-function:cubic-bezier(.15,.75,.4,1)}36%{transform:translate(-47px);animation-timing-function:cubic-bezier(.35,0,.2,1)}52%{transform:translate(-141px);animation-timing-function:ease-in-out}65%{transform:translate(-130px);animation-timing-function:ease-in-out}80%,100%{transform:translate(-132px)}}
.lw-a-ts{animation:lw-a-ts 1.6s both}
@keyframes lw-a-ts{0%{transform:scale(.46);animation-timing-function:cubic-bezier(.2,.6,.35,1)}26%{transform:scale(1.05,.96);animation-timing-function:ease-in-out}33%{transform:scale(.94,1.06);animation-timing-function:cubic-bezier(.4,0,.3,1)}46%{transform:scale(1.02,.975);animation-timing-function:ease-in-out}62%,100%{transform:none}}
.lw-a-g{opacity:0;animation:lw-a-ts 1.6s both,lw-a-g 1.6s linear both}
@keyframes lw-a-g{0%,4%{opacity:0}20%,31%{opacity:1}42%,100%{opacity:0}}
.lw-a-k{animation:lw-a-k 1.6s both}
@keyframes lw-a-k{0%,31%{transform:scale(0,.55);animation-timing-function:cubic-bezier(.2,.7,.4,1)}36%{transform:scale(.3,.8);animation-timing-function:cubic-bezier(.35,0,.2,1)}52%{transform:scale(1.045,.985);animation-timing-function:ease-in-out}65%{transform:scale(.988,1.003);animation-timing-function:ease-in-out}80%,100%{transform:none}}
.lw-a-in,.lw-a-ob,.lw-a-ra{left:calc(var(--w)*-.5);top:calc(var(--h)*-.5);width:var(--w);height:var(--h)}
.lw-a-in,.lw-a-ob{clip-path:inset(0 round calc(var(--h)*.5))}
.lw-a-in,.lw-a-ra{animation:lw-a-tr 1.6s both}
@keyframes lw-a-tr{0%,36%{transform:scale(.56,.8);animation-timing-function:cubic-bezier(.35,0,.2,1)}52%{transform:scale(1.05,.985);animation-timing-function:ease-in-out}65%{transform:scale(.99,1.003);animation-timing-function:ease-in-out}80%,100%{transform:none}}
.lw-a-li{left:0;top:-25%;width:100%;height:150%;background:radial-gradient(closest-side,#6eb4ffbf,#4c9cff75 30%,#3a8bff2b 62%,#3a8bff00);opacity:.45;transform:scale(.85,.9);animation:lw-a-li 1.6s cubic-bezier(.3,0,.2,1) both}
@keyframes lw-a-li{0%,30%{opacity:0;transform:scale(.25,.6)}42%{opacity:1;transform:scale(.8,1);animation-timing-function:cubic-bezier(.45,0,.3,1)}100%{opacity:.45;transform:scale(.85,.9)}}
.lw-a-sw,.lw-a-rs{left:calc(var(--w)*-.46);width:calc(var(--w)*.46);animation:lw-a-sw 3.6s ease-in-out 1.6s infinite}
@keyframes lw-a-sw{0%{transform:none}72%,100%{transform:translateX(calc(var(--w)*1.46))}}
.lw-a-sw{top:-25%;height:150%;background:radial-gradient(closest-side,#5aa5ff5c,#4092ff2b 50%,#3a8bff00)}
.lw-a-gw{filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px #5aa0ffe6)}
.lw-a-ra{box-sizing:border-box;padding:clamp(1.5px,calc(var(--h)*.016),2.4px);border-radius:calc(var(--h)*.5);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask:linear-gradient(#000 0 0) content-box exclude,linear-gradient(#000 0 0)}
.lw-a-rl{left:0;top:-30%;width:100%;height:160%;opacity:0;background:linear-gradient(90deg,#ffffff00,#fff 11%,#c8e2ffb2 17%,#78b4ff38 29%,#78b4ff00 38% 62%,#78b4ff38 71%,#c8e2ffb2 83%,#fff 89%,#ffffff00);animation:lw-a-rl 1.6s cubic-bezier(.3,.55,.3,1) both}
@keyframes lw-a-rl{0%,45%{opacity:0;transform:scale(.1,1)}48%,64%{opacity:1}76%,100%{opacity:0;transform:scale(1.55,1)}}
.lw-a-rs{top:-30%;height:160%;background:radial-gradient(closest-side,#fff,#a8d0ffb2 40%,#3a8bff00)}
.lw-a-bl{left:calc(var(--w)*-.14);top:calc(var(--w)*-.14);width:calc(var(--w)*.28);height:calc(var(--w)*.28);opacity:0;background:radial-gradient(closest-side,#e2f0ffd9,#aad2ff9e 25%,#6eacff4c 52%,#4696ff14 78%,#3a8bff00);animation:lw-a-bl 1.6s both}
@keyframes lw-a-bl{0%,29%{opacity:0;transform:scale(.4)}35%{opacity:.8;transform:scale(.8);animation-timing-function:cubic-bezier(.3,.5,.3,1)}49%,100%{opacity:0;transform:scale(1.7,1)}}
.lw-a-ka{left:calc(var(--w)*-.3);top:calc(var(--h)*.5 + var(--w)*.022);width:calc(var(--w)*.6);height:calc(var(--w)*.06);background:radial-gradient(closest-side,#96c6ffb2,#3a8bff42 50%,#3a8bff00);animation:lw-a-ka 1.6s cubic-bezier(.22,1,.36,1) both}
@keyframes lw-a-ka{0%,38%{opacity:0;transform:scale(.3,1)}80%,100%{opacity:1;transform:none}}
.lw-a-lg{left:21%;top:calc(50% - var(--w)*.03807);width:58%;height:calc(var(--w)*.07614);fill:#0c1a2e;animation:lw-a-lg 1.6s cubic-bezier(.22,1,.36,1) both}
@keyframes lw-a-lg{0%,45%{opacity:0;filter:blur(8px);transform:scale(1.08);fill:#3a8bff}80%,100%{opacity:1;filter:blur(0);transform:none;fill:#0c1a2e}}
.lw-a.weg{pointer-events:none;animation:lw-a-aus .5s linear both}
@keyframes lw-a-aus{0%,85%{opacity:1}100%{opacity:0}}
.lw-a.weg .lw-a-bg{animation:lw-a-vf .5s cubic-bezier(.4,0,.2,1) both}
@keyframes lw-a-vf{0%,12%{opacity:1}100%{opacity:0}}
.lw-a.weg .lw-a-r{animation:lw-a-rw .5s both}
@keyframes lw-a-rw{0%{transform:none;filter:blur(0);opacity:1;animation-timing-function:cubic-bezier(.3,.7,.4,1)}20%{transform:scale(1.04);filter:blur(0);opacity:1;animation-timing-function:cubic-bezier(.55,0,.8,.45)}100%{transform:scale(1.55);filter:blur(14px);opacity:0}}
.lw-a.weg .lw-a-rl{animation:lw-a-rx .5s cubic-bezier(.2,.6,.3,1) both}
@keyframes lw-a-rx{0%{opacity:0;transform:scale(.1,1)}12%{opacity:1}70%,100%{opacity:0;transform:scale(1.5,1)}}
.lw-a.weg .lw-a-am{animation:lw-a-ha .5s cubic-bezier(.2,.7,.3,1) both}
@keyframes lw-a-ha{0%{opacity:.7;transform:none}30%{opacity:1}100%{opacity:0;transform:scale(2.2)}}
@media (prefers-reduced-motion:reduce){.lw-a *{animation:none!important}
.lw-a.weg{animation:lw-a-vf .5s ease both}}`,
  innen: `<i class="lw-a-bg"></i><div class="lw-a-r" aria-hidden="true"><i class="lw-a-am"></i><div class="lw-a-in"><i class="lw-a-li"></i><i class="lw-a-sw"></i></div><svg class="lw-a-s" viewBox="-480 -240 960 480" focusable="false"><radialGradient id="lw-a-rg" cy=".62"><stop offset="0" stop-color="#7fb8ff" stop-opacity=".9"/><stop offset=".5" stop-color="#4f9bff" stop-opacity=".38"/><stop offset="1" stop-color="#3a8bff" stop-opacity="0"/></radialGradient><filter id="lw-a-gl" x="-360" y="-130" width="720" height="300" filterUnits="userSpaceOnUse" color-interpolation-filters="sRGB"><feGaussianBlur in="SourceAlpha" stdDeviation="10" result="b"/><feComponentTransfer in="b" result="s"><feFuncA type="linear" slope="22" intercept="-10"/></feComponentTransfer><feComponentTransfer in="b" result="g"><feFuncR type="discrete" tableValues=".965"/><feFuncG type="discrete" tableValues=".978"/><feFuncB type="discrete" tableValues="1"/><feFuncA type="table" tableValues="0 0 0 0 0 0 0 0 0 0 .9 .7 .54 .44 .38 .35 .34 .33 .33 .33 .33"/></feComponentTransfer><feComponentTransfer in="b" result="ri"><feFuncR type="discrete" tableValues=".16"/><feFuncG type="discrete" tableValues=".42"/><feFuncB type="discrete" tableValues=".95"/><feFuncA type="table" tableValues="0 0 0 0 0 0 0 0 0 0 .18 .3 .26 .18 .11 .06 .03 .01 0 0 0"/></feComponentTransfer><feOffset in="b" dy="18" result="o0"/><feComponentTransfer in="o0" result="sc"><feFuncR type="discrete" tableValues=".07"/><feFuncG type="discrete" tableValues=".16"/><feFuncB type="discrete" tableValues=".29"/><feFuncA type="linear" slope=".2"/></feComponentTransfer><feComposite in="sc" in2="s" operator="out" result="sh"/><feOffset in="b" dx="-3" dy="-6" result="o1"/><feComposite in="s" in2="o1" operator="out" result="c1"/><feComponentTransfer in="c1" result="rb"><feFuncR type="discrete" tableValues=".2"/><feFuncG type="discrete" tableValues=".46"/><feFuncB type="discrete" tableValues="1"/><feFuncA type="gamma" amplitude=".9" exponent="2.4"/></feComponentTransfer><feOffset in="b" dx="3" dy="6" result="o2"/><feComposite in="s" in2="o2" operator="out" result="c2"/><feComponentTransfer in="c2" result="hs"><feFuncR type="discrete" tableValues="1"/><feFuncG type="discrete" tableValues="1"/><feFuncB type="discrete" tableValues="1"/><feFuncA type="gamma" amplitude="2" exponent="2.4"/></feComponentTransfer><feOffset in="s" dx="1" dy="2.6" result="o3"/><feComposite in="s" in2="o3" operator="out" result="c3"/><feColorMatrix in="c3" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 .95 0" result="hl"/><feMerge><feMergeNode in="sh"/><feMergeNode in="g"/><feMergeNode in="ri"/><feMergeNode in="rb"/><feMergeNode in="hs"/><feMergeNode in="hl"/></feMerge></filter><g class="lw-a-dr"><g class="lw-a-tx"><circle class="lw-a-ts lw-a-g" r="50" fill="url(#lw-a-rg)"/></g><g transform="scale(-1 1)"><g class="lw-a-tx"><circle class="lw-a-ts lw-a-g" r="50" fill="url(#lw-a-rg)"/></g></g></g><g filter="url(#lw-a-gl)"><g class="lw-a-dr"><g class="lw-a-tx"><circle class="lw-a-ts" r="68"/></g><g transform="scale(-1 1)"><g class="lw-a-tx"><circle class="lw-a-ts" r="68"/></g></g><rect class="lw-a-k" x="-132" y="-68" width="264" height="136"/></g></g></svg><i class="lw-a-bl"></i><i class="lw-a-ka"></i><div class="lw-a-gw"><div class="lw-a-ra"><i class="lw-a-rl"></i><i class="lw-a-rs"></i></div></div><div class="lw-a-ob"><svg class="lw-a-lg" viewBox="31 -722 5607.05 736" focusable="false"><path d="M578 -708Q574 -660 572.5 -616Q571 -572 571 -548Q571 -526 572 -507Q573 -488 574 -474H551Q536 -554 509.5 -600.5Q483 -647 448.5 -666Q414 -685 373 -685H350Q323 -685 308.5 -680.5Q294 -676 289.5 -662Q285 -648 285 -618V-114Q285 -74 293 -54.5Q301 -35 325 -29Q349 -23 394 -22V0Q361 -1 309 -2Q257 -3 200 -3Q155 -3 111.5 -2Q68 -1 31 0V-20Q62 -22 77.5 -28Q93 -34 98.5 -52Q104 -70 104 -106V-602Q104 -639 98.5 -656.5Q93 -674 77.5 -680.5Q62 -687 31 -688V-708Q74 -707 121.5 -706.5Q169 -706 215.5 -705.5Q262 -705 302.5 -705Q343 -705 369 -705Q415 -705 473.5 -705.5Q532 -706 578 -708ZM431 -364Q431 -364 431 -354Q431 -344 431 -344H255Q255 -344 255 -354Q255 -364 255 -364ZM458 -496Q454 -439 454.5 -409Q455 -379 455 -354Q455 -329 456 -299Q457 -269 461 -212H438Q432 -248 416 -278Q400 -308 373.5 -326Q347 -344 307 -344V-364Q336 -364 358 -376.5Q380 -389 395.5 -409Q411 -429 421 -452Q431 -475 435 -496Z M946 -708V-688Q915 -687 899 -680.5Q883 -674 878 -656.5Q873 -639 873 -602V-106Q873 -70 878.5 -52Q884 -34 899.5 -28Q915 -22 946 -20V0Q918 -2 874.5 -2.5Q831 -3 787 -3Q736 -3 691 -2.5Q646 -2 619 0V-20Q650 -22 665.5 -28Q681 -34 686.5 -52Q692 -70 692 -106V-602Q692 -639 686.5 -656.5Q681 -674 665.5 -680.5Q650 -687 619 -688V-708Q646 -707 691 -706Q736 -705 787 -705Q831 -705 874.5 -706Q918 -707 946 -708Z M1383 -709 1625 -84Q1640 -49 1656.5 -35Q1673 -21 1686 -20V0Q1654 -2 1609.5 -2.5Q1565 -3 1519 -3Q1471 -3 1428 -2.5Q1385 -2 1359 0V-20Q1410 -22 1424 -37.5Q1438 -53 1418 -104L1252 -558L1272 -588L1126 -211Q1103 -151 1098 -114Q1093 -77 1103 -57Q1113 -37 1134.5 -29Q1156 -21 1186 -20V0Q1151 -2 1121.5 -2.5Q1092 -3 1058 -3Q1038 -3 1017.5 -2.5Q997 -2 982 0V-20Q1004 -24 1026.5 -48Q1049 -72 1071 -131L1296 -709Q1316 -707 1339.5 -707Q1363 -707 1383 -709ZM1435 -288V-268H1137L1147 -288Z M2063 -722Q2173 -722 2255 -679Q2337 -636 2382.5 -555.5Q2428 -475 2428 -360Q2428 -248 2381.5 -164Q2335 -80 2252 -33Q2169 14 2062 14Q1953 14 1870.5 -29Q1788 -72 1742.5 -153Q1697 -234 1697 -348Q1697 -460 1744.5 -544Q1792 -628 1874 -675Q1956 -722 2063 -722ZM2059 -704Q2006 -704 1967 -659Q1928 -614 1906.5 -535Q1885 -456 1885 -352Q1885 -246 1909.5 -167.5Q1934 -89 1975 -46.5Q2016 -4 2066 -4Q2119 -4 2158.5 -49Q2198 -94 2219 -173.5Q2240 -253 2240 -356Q2240 -463 2216 -541Q2192 -619 2150.5 -661.5Q2109 -704 2059 -704Z M3148 -708V-688Q3118 -683 3102 -669Q3086 -655 3080.5 -626Q3075 -597 3075 -544V1Q3062 -1 3047 -1Q3032 -1 3015 1L2576 -516V-180Q2576 -119 2582 -86.5Q2588 -54 2609 -40Q2630 -26 2675 -20V0Q2656 -2 2624.5 -2.5Q2593 -3 2565 -3Q2543 -3 2519.5 -2.5Q2496 -2 2480 0V-20Q2512 -26 2527.5 -39.5Q2543 -53 2548 -82.5Q2553 -112 2553 -164V-602Q2553 -639 2548 -656.5Q2543 -674 2527 -680.5Q2511 -687 2480 -688V-708Q2496 -707 2519.5 -706Q2543 -705 2565 -705Q2590 -705 2613 -706Q2636 -707 2655 -708L3052 -254V-528Q3052 -589 3046.5 -621.5Q3041 -654 3020.5 -668.5Q3000 -683 2953 -688V-708Q2973 -707 3004.5 -706Q3036 -705 3063 -705Q3087 -705 3110 -706Q3133 -707 3148 -708Z M3679.55 -31.57Q3703.55 -31.57 3731.13 -37.26Q3758.7 -42.94 3785.01 -53.26Q3811.33 -63.57 3830.69 -77.04L3786.49 -28.21L3844.58 -218.5L3772.17 -237.44L3778.49 -257.65H3977.62L3971.31 -237.44L3912.37 -217.24L3869.42 -77.04L3875.32 -38.31L3873.21 -31.57Q3843.74 -18.52 3811.12 -9.47Q3778.49 -0.42 3744.39 4Q3710.29 8.42 3676.61 8.42Q3593.25 8.42 3537.47 -18.73Q3481.68 -45.89 3453.69 -95.78Q3425.69 -145.67 3425.69 -214.29Q3425.69 -277.44 3444 -332.8Q3462.32 -388.16 3496.42 -433.21Q3530.52 -478.26 3578.3 -510.67Q3626.09 -543.09 3684.6 -560.35Q3743.12 -577.61 3810.06 -577.61Q3833.22 -577.61 3855.32 -575.72Q3877.42 -573.82 3898.89 -569.4Q3920.36 -564.98 3940.99 -556.98L3916.15 -557.4L3975.94 -594.45H3989.83L3948.15 -395.74H3923.31L3904.79 -521.2L3923.31 -500.57Q3892.16 -521.2 3862.9 -529.2Q3833.64 -537.2 3793.64 -537.2Q3739.33 -537.2 3693.45 -521.41Q3647.56 -505.62 3611.35 -477.2Q3575.14 -448.79 3549.88 -409.84Q3524.62 -370.9 3511.57 -324.59Q3498.52 -278.28 3498.52 -226.92Q3498.52 -162.09 3519.78 -118.72Q3541.04 -75.36 3581.67 -53.47Q3622.3 -31.57 3679.55 -31.57Z M4148.97 -533.83Q4141.39 -540.14 4132.97 -545.83Q4124.55 -551.51 4114.45 -556.77Q4104.34 -562.03 4092.13 -566.25L4096.34 -580.14L4217.59 -602.03H4228.54L4056.77 -34.52L4050.03 -48.41Q4065.19 -47.15 4084.14 -52.2Q4103.08 -57.26 4123.92 -68.83Q4144.76 -80.41 4164.97 -97.67L4178.02 -80.83Q4146.02 -46.31 4119.5 -26.94Q4092.98 -7.58 4071.08 0.42Q4049.19 8.42 4029.83 8.42Q4008.36 8.42 3998.88 1.68Q3989.41 -5.05 3994.46 -22.31Z M4430.2 -379.32Q4467.25 -379.32 4493.35 -363.95Q4519.45 -348.59 4533.35 -320.38Q4547.24 -292.17 4547.24 -252.18Q4547.24 -201.24 4531.45 -154.3Q4515.66 -107.35 4487.67 -70.73Q4459.67 -34.1 4421.99 -12.84Q4384.31 8.42 4340.11 8.42Q4303.9 8.42 4277.59 -6.95Q4251.28 -22.31 4237.17 -50.73Q4223.07 -79.15 4223.07 -118.72Q4223.07 -169.66 4238.86 -216.39Q4254.64 -263.12 4282.85 -299.75Q4311.06 -336.38 4348.74 -357.85Q4386.42 -379.32 4430.2 -379.32ZM4341.37 -24Q4364.95 -24 4386.21 -38.31Q4407.47 -52.62 4425.36 -77.04Q4443.25 -101.46 4456.51 -132.83Q4469.77 -164.19 4477.14 -198.92Q4484.51 -233.66 4484.51 -267.33Q4484.51 -307.75 4471.04 -327.33Q4457.57 -346.9 4429.36 -346.9Q4405.78 -346.9 4384.31 -332.59Q4362.84 -318.28 4344.95 -293.86Q4327.06 -269.44 4313.79 -238.08Q4300.53 -206.71 4293.16 -171.98Q4285.8 -137.25 4285.8 -103.14Q4285.8 -63.57 4299.48 -43.78Q4313.16 -24 4341.37 -24Z M4676.49 -135.56Q4671.02 -118.3 4668.7 -103.78Q4666.39 -89.25 4666.39 -77.46Q4666.39 -50.52 4679.44 -36.63Q4692.49 -22.73 4716.91 -22.73Q4740.49 -22.73 4764.69 -37.47Q4788.9 -52.2 4810.58 -76.83Q4832.26 -101.46 4849.1 -132.83Q4865.94 -164.19 4875.63 -197.87Q4885.31 -231.55 4885.31 -263.97Q4885.31 -293.02 4873.1 -308.17Q4860.89 -323.33 4836.89 -323.33Q4820.9 -323.33 4803 -314.49Q4785.11 -305.65 4767.01 -289.86Q4748.91 -274.07 4732.7 -253.44Q4716.49 -232.81 4703.86 -209.24Q4691.23 -185.66 4684.07 -160.82ZM4735.85 -533.41Q4727.86 -539.72 4719.01 -545.62Q4710.17 -551.51 4700.07 -556.56Q4689.97 -561.61 4677.76 -565.82L4681.55 -579.72L4802.37 -602.03H4813.74L4698.81 -224.39L4697.54 -237.02Q4729.12 -287.54 4758.8 -318.7Q4788.48 -349.85 4815.84 -364.59Q4843.21 -379.32 4867.21 -379.32Q4909.31 -379.32 4930.78 -351.53Q4952.25 -323.75 4952.25 -281.65Q4952.25 -238.29 4938.99 -196.19Q4925.73 -154.09 4902.57 -117.25Q4879.42 -80.41 4849.31 -52.2Q4819.21 -24 4785.11 -7.79Q4751.01 8.42 4715.65 8.42Q4666.39 8.42 4638.81 -19.16Q4611.24 -46.73 4611.24 -92.62Q4611.24 -105.25 4613.76 -119.14Q4616.29 -133.04 4620.5 -147.77Z M5194.74 -22.31 5241.89 -163.77H5249.47Q5215.36 -113.25 5188.42 -79.99Q5161.48 -46.73 5139.37 -27.58Q5117.27 -8.42 5098.75 -0.42Q5080.22 7.58 5062.54 7.58Q5038.12 7.58 5019.81 -1.47Q5001.5 -10.53 4991.39 -29.68Q4981.29 -48.84 4981.29 -79.15Q4981.29 -112.41 4993.92 -151.77Q5006.55 -191.13 5029.07 -230.08Q5051.6 -269.02 5082.12 -301.65Q5112.64 -334.27 5148.85 -353.85Q5185.05 -373.43 5224.63 -373.43Q5252.41 -373.43 5269.88 -362.48Q5287.36 -351.53 5299.99 -330.06L5285.67 -306.91Q5279.78 -321.22 5266.31 -330.49Q5252.83 -339.75 5233.05 -339.75Q5201.47 -339.75 5173.48 -320.8Q5145.48 -301.86 5122.11 -271.33Q5098.75 -240.81 5081.91 -206.08Q5065.07 -171.35 5055.81 -139.14Q5046.54 -106.93 5046.54 -84.62Q5046.54 -64.41 5057.91 -54.52Q5069.28 -44.63 5086.96 -44.63Q5102.54 -44.63 5126.11 -58.73Q5149.69 -72.83 5174.74 -97.25Q5199.79 -121.67 5221.47 -154.51Q5243.15 -187.34 5255.78 -224.39L5298.72 -357.85L5349.66 -370.9H5363.98L5251.99 -30.31L5243.15 -47.99Q5257.89 -45.89 5277.04 -51.15Q5296.2 -56.41 5317.46 -68.2Q5338.72 -79.99 5359.35 -97.67L5372.4 -81.25Q5323.14 -30.31 5288.2 -10.95Q5253.25 8.42 5225.89 8.42Q5206.1 8.42 5197.89 0.21Q5189.68 -8 5194.74 -22.31Z M5558.48 -533.83Q5550.91 -540.14 5542.49 -545.83Q5534.07 -551.51 5523.96 -556.77Q5513.86 -562.03 5501.65 -566.25L5505.86 -580.14L5627.11 -602.03H5638.05L5466.29 -34.52L5459.55 -48.41Q5474.71 -47.15 5493.65 -52.2Q5512.6 -57.26 5533.44 -68.83Q5554.27 -80.41 5574.48 -97.67L5587.53 -80.83Q5555.54 -46.31 5529.01 -26.94Q5502.49 -7.58 5480.6 0.42Q5458.71 8.42 5439.34 8.42Q5417.87 8.42 5408.4 1.68Q5398.93 -5.05 5403.98 -22.31Z"/></svg></div></div>`,
};
