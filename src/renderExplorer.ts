// macro ↔ micro 連続ズーム ＋ 色モード切替（indent / heatmap）。
// モジュールマップ（バブル）→ クリック → 型の層ビュー（層1〜4）→ 戻る。
// 色は currentColor＋dc＋data-do/data-dm。トグルで実行時に全要素を再着色（地図・詳細の両方）。
// モードはビュー全体で共通（混ぜると境界で色飛びするため）。

import { extractModule } from './extractModule.ts'
import { extractType } from './extract.ts'
import { layoutModule, drawMapInner } from './renderModuleMap.ts'
import { buildPieceInner, PIECE_VIEWBOX } from './renderInteractive.ts'

const SANS = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif'

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export interface ExplorerOptions {
  fileName?: string
}

export function renderExplorer(source: string, opts: ExplorerOptions = {}): string {
  const mod = extractModule(source, { fileName: opts.fileName })
  const layout = layoutModule(mod)
  const mapInner = drawMapInner(layout, mod, { clickable: true, colorMode: 'indent' })
  const mapSvg = `<svg class="ex-mapsvg" viewBox="0 0 ${layout.vbw} ${layout.vbh}" width="100%" font-family="${SANS}"><rect x="0.5" y="0.5" width="${layout.vbw - 1}" height="${layout.vbh - 1}" rx="12" fill="#ffffff" stroke="#e5e7eb"/>${mapInner}</svg>`

  const details = Object.keys(mod.types)
    .map((name) => {
      const doc = extractType(source, name, { fileName: opts.fileName })
      return `<div class="detail" data-type="${esc(name)}" style="display:none"><svg class="detailsvg" viewBox="${PIECE_VIEWBOX}" width="100%" font-family="${SANS}">${buildPieceInner(doc)}</svg></div>`
    })
    .join('')

  return `<div class="ex">
<style>
.ex{font-family:var(--font-sans);padding:0.5rem 0}
.ex .ex-title{text-align:center;font-size:12px;color:var(--color-text-secondary);margin-bottom:6px}
.ex .ex-modes{display:flex;gap:6px;justify-content:center;margin-bottom:8px}
.ex .ex-mode{font:inherit;font-size:11px;padding:3px 12px;cursor:pointer;border:1px solid var(--color-border-secondary);border-radius:999px;background:var(--color-background-secondary);color:var(--color-text-secondary)}
.ex .ex-mode.on{background:var(--color-text-primary);color:var(--color-background-primary);border-color:var(--color-text-primary)}
.ex .ex-map .mapnode:hover circle{fill-opacity:0.32}
.ex .ex-map,.ex .ex-detail{transition:opacity .24s ease,transform .24s ease}
.ex .leaving{opacity:0;transform:scale(1.08)}
.ex .entering{opacity:0;transform:scale(0.94)}
.ex .ex-bar{display:flex;align-items:center;gap:12px;justify-content:center;margin-bottom:4px}
.ex .ex-label{font-size:13px;font-weight:500;color:var(--color-text-primary)}
.ex .ex-body{display:flex;align-items:center;justify-content:center;gap:14px}
.ex .ex-stage{display:flex;justify-content:center}
.ex .ex-zoom{display:flex;flex-direction:column;align-items:center;gap:6px;font-size:10px;color:var(--color-text-tertiary)}
.ex .ex-foot{display:flex;justify-content:flex-end;margin-top:8px}
.ex .ex-back{font:inherit;font-size:12px;padding:5px 12px;cursor:pointer;border:1px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:var(--color-background-secondary);color:var(--color-text-primary)}
.ex svg .mItem,.ex svg .sub{transition:transform .22s ease,opacity .22s ease}
.ex svg .fade,.ex svg .mLabel,.ex svg .conn{transition:opacity .22s ease}
.ex svg .dc,.ex svg .mapnode circle{transition:color .22s ease,fill-opacity .15s ease}
.ex .ex-slider{-webkit-appearance:slider-vertical;appearance:slider-vertical;writing-mode:vertical-lr;width:6px;height:190px;margin:0;accent-color:var(--color-text-primary);cursor:pointer}
.ex .ex-legend{text-align:center;font-size:11px;color:var(--color-text-secondary);margin-top:6px}
.ex .sw{display:inline-block;width:10px;height:10px;border-radius:50%;vertical-align:middle;margin:0 3px 0 10px}
</style>
<div class="ex-title">モジュールマップ — バブルをクリックして型へズーム</div>
<div class="ex-modes">
  <button class="ex-mode" data-mode="indent">インデント（自分の深さ）</button>
  <button class="ex-mode" data-mode="heatmap">ヒートマップ（配下の最深）</button>
</div>
<div class="ex-map">${mapSvg}</div>
<div class="ex-detail" style="display:none">
  <div class="ex-bar"><span class="ex-label">第1層 — 形＋名前</span></div>
  <div class="ex-body">
    <div class="ex-stage">${details}</div>
    <div class="ex-zoom"><span>第1層</span><input class="ex-slider" type="range" min="1" max="4" step="0.01" value="1"><span>第4層</span></div>
  </div>
  <div class="ex-legend">色＝深度：<span class="sw" style="background:#2563eb"></span>深0<span class="sw" style="background:#0d9488"></span>深1<span class="sw" style="background:#d97706"></span>深2<span class="sw" style="background:#dc2626"></span>深3</div>
  <div class="ex-foot"><button class="ex-back">← モジュールへ戻る</button></div>
</div>
<script>
(function(){
  var sel=function(s,r){return (r||document).querySelector(s)};
  var all=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  var clamp=function(x,a,b){return Math.max(a,Math.min(b,x))};
  var lerp=function(a,b,t){return a+(b-a)*t};
  var num=function(s){return s.split(',').map(parseFloat)};
  var RAMP=['#2563eb','#0d9488','#d97706','#dc2626'];
  var dcol=function(d){return RAMP[clamp(Math.round(d),0,RAMP.length-1)]};
  var root=sel('.ex');
  if(!root)return;
  var titleEl=sel('.ex-title',root), mapWrap=sel('.ex-map',root), detailWrap=sel('.ex-detail',root);
  var slider=sel('.ex-slider',root), label=sel('.ex-label',root), back=sel('.ex-back',root), body=sel('.ex-body',root);
  var active=null, mode='indent';

  function recolor(){
    all('.dc',root).forEach(function(el){
      var d = mode==='heatmap' ? parseFloat(el.dataset.dm) : parseFloat(el.dataset.do);
      el.style.color = dcol(d);
    });
  }
  function setMode(m){
    mode=m; recolor();
    all('.ex-mode',root).forEach(function(b){ b.classList.toggle('on', b.dataset.mode===m); });
  }
  function update(L){
    if(!active)return;
    var t12=clamp(L-1,0,1), t23=clamp(L-2,0,1), t34=clamp(L-3,0,1);
    var bound=active.querySelector('.bound'), nm=active.querySelector('.nm');
    if(bound)bound.style.opacity=1-0.45*t12;
    if(nm)nm.style.opacity=1-t12;
    all('.mItem',active).forEach(function(it){
      var cl=num(it.dataset.cl), row=num(it.dataset.row);
      it.setAttribute('transform','translate('+lerp(cl[0],row[0],t23)+','+lerp(cl[1],row[1],t23)+')');
      it.style.opacity=t12;
    });
    all('.mLabel',active).forEach(function(l){l.style.opacity=t23});
    all('.sub',active).forEach(function(s){
      var x=parseFloat(s.dataset.x), y=parseFloat(s.dataset.y);
      s.setAttribute('transform','translate('+(x-16*(1-t34))+','+y+')');
      s.style.opacity=t34;
    });
    all('.conn',active).forEach(function(c){c.style.opacity=t34});
    label.textContent = L<1.5?'第1層 — 形＋名前' : L<2.5?'第2層 — 構成アイコン（ラベル無し）' : L<3.5?'第3層 — アイコン＋ラベル' : '第4層 — ネスト展開（色＝深度）';
  }
  var busy=false;
  // 拡大＋クロスフェードで滑らかに切り替える
  function swapView(hideEl, showEl, prep){
    if(busy)return;
    busy=true;
    hideEl.classList.add('leaving');
    setTimeout(function(){
      hideEl.style.display='none'; hideEl.classList.remove('leaving');
      if(prep)prep();
      showEl.classList.add('entering'); showEl.style.display='';
      void showEl.offsetWidth; // reflow
      showEl.classList.remove('entering');
      busy=false;
    }, 240);
  }
  function showMap(){
    if(detailWrap.style.display==='none'){
      mapWrap.style.display=''; active=null;
      titleEl.textContent='モジュールマップ — バブルをクリックして型へズーム';
      return;
    }
    swapView(detailWrap, mapWrap, function(){
      active=null;
      titleEl.textContent='モジュールマップ — バブルをクリックして型へズーム';
    });
  }
  function showDetail(name){
    swapView(mapWrap, detailWrap, function(){
      all('.detail',root).forEach(function(d){d.style.display = (d.dataset.type===name)?'':'none'});
      var panel=sel('.detail[data-type="'+name+'"]',root);
      active = panel ? panel.querySelector('.detailsvg') : null;
      titleEl.textContent='型: '+name+' — スライダ/ホイールで層1〜4';
      slider.value=1; update(1); recolor();
    });
  }
  all('.mapnode',root).forEach(function(g){
    g.addEventListener('click',function(){showDetail(g.getAttribute('data-type'))});
  });
  all('.ex-mode',root).forEach(function(b){
    b.addEventListener('click',function(){setMode(b.dataset.mode)});
  });
  back.addEventListener('click',showMap);
  slider.addEventListener('input',function(){update(parseFloat(slider.value))});
  if(body)body.addEventListener('wheel',function(e){e.preventDefault();var nv=clamp(parseFloat(slider.value)+(e.deltaY>0?0.04:-0.04),1,4);slider.value=nv;update(nv);},{passive:false});
  showMap();
  setMode('indent');
})();
</script>
</div>`
}
