// IR駆動のインタラクティブ・セマンティックズーム（層×深度）。
// 器は種類ごとのシルエット（shapes.ts）。層フェードは破線/実線を壊さないよう「透明度」で行う。
// 深度色は currentColor＋dcクラス＋data-do/data-dm（実行時に再着色）。
// buildPieceInner(doc) はピース内側SVGを返し、単体ウィジェットと explorer の両方で再利用。

import type { Doc, TypeIR } from './ir.ts'
import { containerOutline, glyphKindOf, miniGlyph, resolveShapeKind } from './shapes.ts'

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
const SANS = 'ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif'
const RAMP = ['#2563eb', '#0d9488', '#d97706', '#dc2626']
const depth = (d: number) => RAMP[Math.min(Math.max(d, 0), RAMP.length - 1)]

export const PIECE_VIEWBOX = '0 0 450 212'

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function dca(own: number, max: number, extra = ''): string {
  return `data-do="${own}" data-dm="${max}" style="color:${depth(own)}${extra ? ';' + extra : ''}"`
}

function objMembers(t: TypeIR, defs: Record<string, TypeIR>): { name: string; type: TypeIR }[] | null {
  let x: TypeIR | undefined = t
  if (t.kind === 'ref') x = defs[t.id]
  if (x && (x.kind === 'object' || x.kind === 'class')) return x.members
  return null
}

function resolveRoot(doc: Doc): { name: string; members: { name: string; type: TypeIR }[] } {
  let name = '(anonymous)'
  let target: TypeIR = doc.root
  if (doc.root.kind === 'ref') {
    name = doc.root.name
    target = doc.defs[doc.root.id]
  }
  if (target && target.kind === 'class') name = target.name
  const members = target && (target.kind === 'object' || target.kind === 'class') ? target.members : []
  return { name, members }
}

// ピースの内側（<g>…</g>）。器は種類別、色は currentColor、深度は data 属性。
export function buildPieceInner(doc: Doc): string {
  const { name, members } = resolveRoot(doc)
  const defs = doc.defs
  const W = 180
  const H = 168
  const cx = W / 2
  const cy = H / 2
  const n = members.length
  const cols = Math.max(1, Math.ceil(Math.sqrt(n)))
  const cw = 34
  const ch = 32
  const rows = Math.ceil(n / cols)
  const sx = cx - (cols * cw) / 2 + cw / 2
  const syC = cy - (rows * ch) / 2 + ch / 2
  const rh = 30
  const ry0 = cy - (n * rh) / 2 + rh / 2
  const iconX = cx - 48
  const labelX = cx - 30
  const subW = 150
  const subH = 118
  const subX = W + 56
  const scx = subW / 2
  const scy = subH / 2

  const rootShape = resolveShapeKind(doc.root, defs)
  const memberMax = (m: { type: TypeIR }) => (objMembers(m.type, defs) ? 2 : 1)
  const rootMax = members.length ? Math.max(...members.map(memberMax)) : 0

  const parts: string[] = []
  // ルートの器（種類別シルエット）。層フェードは透明度（実線/破線は保持）。
  parts.push(`<g class="bound dc fade" ${dca(0, rootMax)}>${containerOutline(rootShape, W, H)}</g>`)
  parts.push(`<text class="nm fade" x="${cx}" y="${cy + 5}" text-anchor="middle" font-size="16" fill="var(--color-text-primary)" font-family="${MONO}">${esc(name)}</text>`)

  let nestedJ = 0
  members.forEach((m, i) => {
    const sub = objMembers(m.type, defs)
    const mm = sub ? 2 : 1
    const clx = sx + (i % cols) * cw
    const cly = syC + Math.floor(i / cols) * ch
    const ry = ry0 + i * rh
    parts.push(
      `<g class="mItem dc" data-cl="${clx},${cly}" data-row="${iconX},${ry}" ${dca(1, mm, 'opacity:0')} transform="translate(${clx},${cly})">${miniGlyph(glyphKindOf(m.type, defs))}</g>`,
    )
    parts.push(
      `<text class="mLabel" x="${labelX}" y="${ry + 4}" font-size="13" fill="var(--color-text-primary)" font-family="${MONO}" style="opacity:0">${esc(m.name)}</text>`,
    )
    if (sub) {
      const subYj = 6 + nestedJ * (subH + 18)
      const subTitle = m.type.kind === 'ref' ? m.type.name : m.name
      const subShape = resolveShapeKind(m.type, defs)
      parts.push(
        `<line class="conn" x1="${W}" y1="${ry}" x2="${subX}" y2="${subYj + scy}" stroke="#c7ccd2" stroke-width="1.2" stroke-dasharray="3 3" style="opacity:0"/>`,
      )
      const sp: string[] = []
      sp.push(`<g class="sub" data-x="${subX}" data-y="${subYj}" transform="translate(${subX},${subYj})" style="opacity:0">`)
      sp.push(`<g class="dc" ${dca(1, 2)}>${containerOutline(subShape, subW, subH)}</g>`)
      sp.push(`<text class="dc" ${dca(1, 2)} x="${scx}" y="14" text-anchor="middle" font-size="11" fill="currentColor" font-family="${MONO}">${esc(subTitle)}</text>`)
      const k = sub.length
      const srh = 26
      const sry0 = scy - (k * srh) / 2 + srh / 2 + 6
      sub.forEach((sm, si) => {
        const sry = sry0 + si * srh
        sp.push(`<g class="dc" ${dca(2, 2)} transform="translate(${scx - 44},${sry})">${miniGlyph(glyphKindOf(sm.type, defs))}</g>`)
        sp.push(
          `<text x="${scx - 28}" y="${sry + 4}" font-size="12" fill="var(--color-text-primary)" font-family="${MONO}">${esc(sm.name)}</text>`,
        )
      })
      sp.push(`</g>`)
      parts.push(sp.join(''))
      nestedJ++
    }
  })

  return `<g transform="translate(24,26)">${parts.join('')}</g>`
}

export function renderInteractive(doc: Doc): string {
  const svg = `<svg id="izsvg" viewBox="${PIECE_VIEWBOX}" width="100%" font-family="${SANS}">${buildPieceInner(doc)}</svg>`
  return `<div class="iz">
<style>
.iz{font-family:var(--font-sans);padding:0.75rem 0;text-align:center}
.iz .hint{font-size:12px;color:var(--color-text-secondary);margin-bottom:6px}
.iz .legend{font-size:11px;color:var(--color-text-secondary);margin-top:6px}
.iz .sw{display:inline-block;width:10px;height:10px;border-radius:50%;vertical-align:middle;margin:0 3px 0 10px}
.iz svg .mItem,.iz svg .sub{transition:transform .22s ease,opacity .22s ease}
.iz svg .fade,.iz svg .mLabel,.iz svg .conn{transition:opacity .22s ease}
.iz svg .dc{transition:color .22s ease}
.iz .lbl{font-size:13px;font-weight:500;color:var(--color-text-primary);margin:6px 0 2px}
.iz .slider{width:80%;margin:4px auto 0;display:block;accent-color:var(--color-text-primary)}
.iz .ticks{display:flex;justify-content:space-between;width:80%;margin:0 auto;font-size:11px;color:var(--color-text-tertiary)}
.iz .btns{margin-top:10px;display:flex;gap:6px;justify-content:center;flex-wrap:wrap}
.iz .btns button{font:inherit;font-size:12px;padding:4px 10px;cursor:pointer;border:1px solid var(--color-border-secondary);border-radius:var(--border-radius-md);background:var(--color-background-secondary);color:var(--color-text-primary)}
</style>
<div class="hint">スライダ／図の上でスクロール／ボタン で層を移動（第4層でネストが開き、色＝深度）</div>
<div style="display:flex;justify-content:center">${svg}</div>
<div id="izlabel" class="lbl">第1層 — 形＋名前</div>
<input id="izslider" class="slider" type="range" min="1" max="4" step="0.01" value="1">
<div class="ticks"><span>第1層</span><span>第2層</span><span>第3層</span><span>第4層</span></div>
<div class="btns"><button data-l="1">第1層</button><button data-l="2">第2層</button><button data-l="3">第3層</button><button data-l="4">第4層</button></div>
<div class="legend">色＝深度：<span class="sw" style="background:#2563eb"></span>深0（器）<span class="sw" style="background:#0d9488"></span>深1（メンバ）<span class="sw" style="background:#d97706"></span>深2（ネスト内）</div>
<script>
(function(){
  var sel=function(s,r){return (r||document).querySelector(s)};
  var all=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
  var clamp=function(x,a,b){return Math.max(a,Math.min(b,x))};
  var lerp=function(a,b,t){return a+(b-a)*t};
  var num=function(s){return s.split(',').map(parseFloat)};
  var root=sel('.iz');
  if(!root)return;
  var slider=sel('#izslider',root), label=sel('#izlabel',root), svg=sel('#izsvg',root);
  var bound=sel('.bound',root), nm=sel('.nm',root);
  var items=all('.mItem',root), labels=all('.mLabel',root), subs=all('.sub',root), conns=all('.conn',root);
  function update(L){
    var t12=clamp(L-1,0,1), t23=clamp(L-2,0,1), t34=clamp(L-3,0,1);
    if(bound)bound.style.opacity=1-0.45*t12;
    if(nm)nm.style.opacity=1-t12;
    items.forEach(function(it){
      var cl=num(it.dataset.cl), row=num(it.dataset.row);
      it.setAttribute('transform','translate('+lerp(cl[0],row[0],t23)+','+lerp(cl[1],row[1],t23)+')');
      it.style.opacity=t12;
    });
    labels.forEach(function(l){l.style.opacity=t23});
    subs.forEach(function(s){
      var x=parseFloat(s.dataset.x), y=parseFloat(s.dataset.y);
      s.setAttribute('transform','translate('+(x-16*(1-t34))+','+y+')');
      s.style.opacity=t34;
    });
    conns.forEach(function(c){c.style.opacity=t34});
    label.textContent = L<1.5?'第1層 — 形＋名前' : L<2.5?'第2層 — 構成アイコン（ラベル無し）' : L<3.5?'第3層 — アイコン＋ラベル' : '第4層 — ネスト展開（色＝深度）';
  }
  slider.addEventListener('input',function(){update(parseFloat(slider.value))});
  if(svg)svg.addEventListener('wheel',function(e){e.preventDefault();var nv=clamp(parseFloat(slider.value)+(e.deltaY>0?0.04:-0.04),1,4);slider.value=nv;update(nv);},{passive:false});
  all('.iz .btns button',root).forEach(function(b){b.addEventListener('click',function(){var nv=parseFloat(b.getAttribute('data-l'));slider.value=nv;update(nv);});});
  update(1);
})();
</script>
</div>`
}
