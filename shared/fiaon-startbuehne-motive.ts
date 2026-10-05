// ERZEUGT von scratchpad/lader/motive.py aus den Entwürfen privat-p1b (Privat) und business-b3b (Business).
// Die Motive der Startbühne (E-287): Justin wählte am 06.10.2026 „Riffelglas“ (Privat) und „Fassade“ (Business).
// Nicht von Hand ändern — Fragment ändern, Werkbank (bau.mjs) prüfen, neu erzeugen.
/* eslint-disable */
import { MARKE_PFAD, MARKE_PFAD_GLOBAL_ZUSATZ, markeBuchstaben } from "./fiaon-marke";

const B = markeBuchstaben();

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

export const MOTIV_BUSINESS: BuehnenMotiv = {
  quelle: "business-b3b",
  klasse: "x-b3b",
  aria: "FIAON Global lädt",
  mindestensMs: 1300,
  stil: `.x-b3b{position:fixed;inset:0;z-index:10;overflow:hidden;background:#f5f7fa;--y:55%;--h:36%;--s:clamp(60px,6.2vw,96px);--p:3px;--b:calc(var(--s)*.56);--n:3;--e:calc(var(--b) + var(--n)*var(--s) + var(--p));--w:min(25vw,330px);--r:var(--s);--ro:64px;--o:calc(var(--y) - var(--h)/2);--u:calc(var(--y) + var(--h)/2);--k:linear-gradient(#eef1f5 0 1px,#e4e9f0 0);--d:calc(var(--b) - var(--e))}
@media (orientation:portrait){.x-b3b{--y:50%;--h:35%;--s:15.5vw;--p:2.5px;--n:2;--w:60vw;--ro:18px}}
.x-b3b .b3b-sz{position:absolute;inset:0;transform-origin:50% var(--y)}
.x-b3b b{position:absolute;left:calc(50% - var(--e) - var(--x,0px));right:calc(50% - var(--e) - var(--x,0px));top:var(--o);height:var(--h);animation:b3b-x .55s cubic-bezier(.3,0,.2,1) both}
.x-b3b .b3b-st{--x:var(--d);outline:150vmax solid #f5f7fa;animation:none}
.x-b3b .b3b-bo{--x:50vw;top:calc(var(--u) + 15px);height:1px;background:#d9dfe8;animation-delay:.1s}
.x-b3b .b3b-s2{--x:30px;top:calc(var(--u) + 9px);height:6px;background:var(--k);animation-delay:.05s}
.x-b3b .b3b-s1{--x:16px;top:calc(var(--u) + 3px);height:6px;background:var(--k)}
.x-b3b .b3b-fl{--x:2px;top:var(--u);height:3px;background:#12284a}
.x-b3b .b3b-g{overflow:hidden;background:linear-gradient(108deg,#fff0 22%,#ffffffb3 30%,#fff0 38%) 0 0/calc(2*var(--e)) 100% no-repeat,linear-gradient(#0b1c361a,#0b1c3600 30px),linear-gradient(#e9f0f8,#f6f8fb);animation:b3b-ein .5s ease .3s both}
.x-b3b .b3b-ga{right:calc(50% + var(--b))}
.x-b3b .b3b-gb{left:calc(50% + var(--b));background-position:100% 0}
.x-b3b .b3b-sp{position:absolute;top:0;bottom:0;width:60%;background:linear-gradient(100deg,#fff0 15%,#fffc 50%,#fff0 85%);transform:translateX(-120%);animation:b3b-glanz 5.4s cubic-bezier(.4,0,.6,1) 1.4s infinite}
.x-b3b .b3b-gb .b3b-sp{animation-delay:2.5s}
.x-b3b .b3b-tl,.x-b3b .b3b-tr{--x:var(--d);background:linear-gradient(#12284a 0 0) var(--g) 52%/2px 18px no-repeat,linear-gradient(#0b1c361a,#0b1c3600 30px),linear-gradient(#dde6f2,#edf2f8);animation:b3b-ein .5s ease .3s both}
.x-b3b .b3b-tl{right:50%;--g:calc(100% - 6px);--m:-100%}
.x-b3b .b3b-tr{left:50%;--g:6px;--m:100%}
.x-b3b .b3b-gl{--x:var(--d);background:linear-gradient(90deg,#1d4ed800,#1d4ed833,#1d4ed800)}
.x-b3b .b3b-li{--x:calc(1px - var(--e));background:#1d4ed8}
.x-b3b .b3b-gl,.x-b3b .b3b-li{animation:b3b-ein .5s ease 1.2s both,b3b-puls 3.2s ease-in-out 1.7s infinite alternate}
.x-b3b .b3b-pl,.x-b3b .b3b-pr{position:absolute;top:var(--o);height:var(--h);width:calc(var(--n)*var(--s) + var(--p));left:calc(50% + var(--b));background:repeating-linear-gradient(90deg,#12284a 0 var(--p),#0000 0 var(--s));animation:b3b-pr .7s cubic-bezier(.3,.6,.3,1) .12s both}
.x-b3b .b3b-pl{left:auto;right:calc(50% + var(--b));transform:scaleX(-1)}
.x-b3b .b3b-da{--x:var(--ro);top:calc(var(--o) - var(--r));height:var(--r);background:linear-gradient(#1f3d6b 0 2px,#12284a 2px calc(100% - 5px),#0b1c36 0);animation:b3b-x .42s cubic-bezier(.25,.6,.2,1) .38s both}
.x-b3b .b3b-mk{position:absolute;left:50%;top:calc(var(--o) - var(--r)/2 - var(--w)*.0656 - 3px);width:var(--w);height:calc(var(--w)*.13126);margin-left:calc(var(--w)/-2);animation:b3b-rueck .45s cubic-bezier(.65,0,.25,1) .86s both}
.x-b3b .b3b-mk svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.x-b3b .b3b-m1{clip-path:inset(-20% 43.5% -20% -2%);animation:b3b-auf .42s cubic-bezier(.4,0,.2,1) .58s both}
.x-b3b .b3b-m2{clip-path:inset(-20% -3% -20% 56.4%);animation:b3b-wg .35s cubic-bezier(.45,0,.2,1) .9s both}
.x-b3b .b3b-or{position:absolute;left:0;right:0;top:calc(var(--u) + 42px);padding-left:.28em;text-align:center;font:10.5px/1 Georgia,serif;letter-spacing:.28em;color:#5f6b7e;animation:b3b-ein .5s ease 1.1s both}
@keyframes b3b-x{from{transform:scaleX(0)}}
@keyframes b3b-pr{from{clip-path:polygon(0 100%,100% 100%,100% 100%,0 100%)}55%{clip-path:polygon(0 0,100% 100%,100% 100%,0 100%)}to{clip-path:polygon(0 0,100% 0,100% 100%,0 100%)}}
@keyframes b3b-ein{from{opacity:0}}
@keyframes b3b-puls{to{opacity:.5}}
@keyframes b3b-glanz{0%{transform:translateX(-120%)}50%,to{transform:translateX(240%)}}
@keyframes b3b-rueck{from{transform:translateX(22.23%)}}
@keyframes b3b-auf{from{clip-path:inset(-20% 72.3% -20% 27.8%)}}
@keyframes b3b-wg{from{clip-path:inset(-20% 43.7% -20% 56.4%)}}
.x-b3b.weg{background:none;pointer-events:none;animation:b3b-ende .8s linear both}
.x-b3b.weg .b3b-sz{animation:b3b-flug .8s cubic-bezier(.7,0,.85,.15) both}
.x-b3b.weg .b3b-tl,.x-b3b.weg .b3b-tr{animation:b3b-l .3s cubic-bezier(.6,0,.2,1) both}
.x-b3b.weg .b3b-li,.x-b3b.weg .b3b-gl{animation:b3b-aus .2s both}
@keyframes b3b-flug{to{transform:scale(7)}}
@keyframes b3b-l{to{transform:translateX(var(--m))}}
@keyframes b3b-aus{to{opacity:0}}
@keyframes b3b-ende{70%{opacity:1}to{opacity:0}}
@media (prefers-reduced-motion:reduce){.x-b3b *{animation:none!important}.x-b3b.weg{animation:b3b-aus .4s both}}`,
  innen: `<div class="b3b-sz" aria-hidden="true"><b class="b3b-st"></b><b class="b3b-bo"></b><b class="b3b-s2"></b><b class="b3b-s1"></b><b class="b3b-tl"></b><b class="b3b-tr"></b><b class="b3b-g b3b-ga"><i class="b3b-sp"></i></b><b class="b3b-g b3b-gb"><i class="b3b-sp"></i></b><b class="b3b-gl"></b><b class="b3b-li"></b><i class="b3b-pl"></i><i class="b3b-pr"></i><b class="b3b-fl"></b><b class="b3b-da"></b><div class="b3b-mk"><svg class="b3b-m1" viewBox="31 -722 5607.05 736"><path fill="#fff" d="${MARKE_PFAD.fiaon}"/></svg><svg class="b3b-m2" viewBox="31 -722 5607.05 736"><path fill="#c9d7f2" d="${MARKE_PFAD_GLOBAL_ZUSATZ}"/></svg></div><i class="b3b-or">LONDON · ZÜRICH · MIAMI</i></div>`,
};
