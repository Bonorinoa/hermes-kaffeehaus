import { createController } from './controller.mjs';
import { layout } from './layout.mjs';
import { createOverlay } from './overlay.mjs';

let sceneSerial = 0;
// All selectors below are private host hooks. No content, session ids or atoms read.
export function mountScene(surface, ctx, sdk, {now = () => new Date(), onState = () => {}} = {}) {
  const refused = reason => ({enabled:false,reason,dispose() {}});
  if (!surface?.matches('[data-chat-surface]') || !surface.isConnected || surface.hasAttribute('data-kaffeehaus')) return refused('Unavailable or already owned chat surface');
  if (!ctx?.onDispose || !ctx.setInterval || !ctx.addEventListener || typeof ResizeObserver!=='function') return refused('Scoped lifecycle unavailable');
  const one = slot => {const all=surface.querySelectorAll(`[data-slot="${slot}"]`);return all.length===1?all[0]:null;};
  const bounds=one('composer-bounds'), thread=one('thread'), content=one('aui_thread-content'), viewport=one('aui_thread-viewport'), dock=one('composer-dock');
  if (!bounds||!thread||!content||!viewport||!dock||!bounds.contains(thread)||!thread.contains(viewport)||!viewport.contains(content)||surface.querySelector('[data-popped-out]')||surface.closest('[data-hud-shell]')) return refused('Expected private chat hooks missing (floating/HUD not supported)');
  const forced=matchMedia('(forced-colors: active)');
  // Resolve CSS colors through the browser's sRGB conversion, not a numeric
  // regex (color(srgb), lab, oklch and host color-mix use different units).
  const probe=document.createElement('canvas');probe.width=probe.height=1;
  const sample=probe.getContext('2d',{willReadFrequently:true});
  const rgba=color=>{
    if(!CSS.supports('color',color))return null;
    sample.clearRect(0,0,1,1);sample.fillStyle='#ff00ff';sample.fillStyle=color;
    sample.fillRect(0,0,1,1);
    return sample.getImageData(0,0,1,1).data;
  };
  // Glass translucency makes the surface itself transparent. The backdrop the
  // user then sees is the theme's chrome token (opaque beside a glass rail), and
  // the scene paints over it anyway, so judge that token instead. A zero-size
  // hidden probe inherits the surface's custom properties.
  const token=document.createElement('span');token.setAttribute('aria-hidden','true');token.dataset.kaffeehausProbe='';
  token.style.cssText='position:absolute;width:0;height:0;overflow:hidden;visibility:hidden;pointer-events:none;background-color:var(--ui-bg-chrome)';
  const supportedAppearance=()=>{
    if(forced.matches||!sample)return false;
    const attached=token.isConnected;
    try {
      const style=getComputedStyle(surface);
      if(style.backgroundImage!=='none')return false;
      let bg=rgba(style.backgroundColor);
      if(bg&&bg[3]<255){if(!attached)surface.append(token);bg=rgba(getComputedStyle(token).backgroundColor)}
      const fg=rgba(style.color);
      if(!bg||!fg||bg[3]!==255||fg[3]===0)return false;
      // Dark backdrop AND light text: the veil darkens the scene behind text.
      return bg[0]<=120&&bg[1]<=120&&bg[2]<=120&&(fg[0]+fg[1]+fg[2])/3>=160;
    }catch{return false} // Unavailable/unreadable/unsupported is native, not dark.
    finally{if(!attached)token.remove()}
  };
  if(!supportedAppearance())return refused('Unsupported appearance / forced colors; native chat preserved');
  const canvas=document.createElement('canvas'), paint=canvas.getContext('2d');
  if (!paint) return refused('Canvas unavailable');
  const restores=[], off=[];
  const own=(node,name,value,priority='')=>{
    const old=node.style.getPropertyValue(name),p=node.style.getPropertyPriority(name);
    restores.push(()=>old?node.style.setProperty(name,old,p):node.style.removeProperty(name));
    node.style.setProperty(name,value,priority);
  };
  const id=`kh-${++sceneSerial}`;surface.setAttribute('data-kaffeehaus',id);
  own(surface,'--composer-width','780px');own(bounds,'background-color','transparent');own(bounds,'isolation','isolate');
  for (const p of ['width','margin-left','margin-right']) own(content,p,content.style.getPropertyValue(p));
  for (const p of ['left','right','transform','translate']) own(dock,p,dock.style.getPropertyValue(p));
  // Tailwind 4 uses individual translate; it composes with transform. Own both
  // mechanisms while mounted, then restore each original value and priority.
  dock.style.translate='none';
  const veil=document.createElement('div');veil.setAttribute('aria-hidden','true');
  veil.style.cssText='position:absolute;inset:0;z-index:-1;pointer-events:none';
  canvas.setAttribute('aria-hidden','true');canvas.dataset.kaffeehausCanvas='';
  canvas.style.cssText='position:absolute;left:0;bottom:0;pointer-events:none;image-rendering:pixelated;z-index:-2';
  bounds.prepend(canvas,veil);surface.append(token); // keep the appearance probe mounted: no per-frame DOM churn
  const back=document.createElement('button');back.type='button';back.textContent='Back to chat';back.dataset.kaffeehausBack='';
  back.style.cssText='position:absolute;top:12px;right:12px;z-index:50;padding:10px 16px;color:var(--ui-text-primary);background:var(--ui-panel-background,var(--ui-chat-surface-background));border:2px solid var(--ui-stroke-secondary);border-radius:6px';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  // In-scene controls (menu board / glass pill). Errors from bad patches are ignored, never thrown into the app.
  const overlay=createOverlay({root:bounds,listen:(n,t,f)=>off.push(ctx.addEventListener(n,t,f)),update:patch=>{try{if(!disposed)controller.update(patch)}catch{}}});
  let loop=null, frame=0;
  let disposed=false,tearingDown=false, controller, peek=false, priorFocus=null, peekRestore=[];
  const setPeek=value=>{
    if(disposed||peek===value)return;
    peek=value;
    if(peek){
      priorFocus=document.activeElement;
      for(const node of [thread,dock]){
        const inert=node.inert,visibility=node.style.getPropertyValue('visibility'),p=node.style.getPropertyPriority('visibility');
        peekRestore.push(()=>{node.inert=inert;visibility?node.style.setProperty('visibility',visibility,p):node.style.removeProperty('visibility')});
        node.inert=true;node.style.visibility='hidden';
      }
      bounds.append(back);back.focus({preventScroll:true});
    }else{
      for(const fn of peekRestore.reverse())fn();peekRestore=[];back.remove();
      if(priorFocus?.isConnected&&!priorFocus.closest('[inert]'))priorFocus.focus({preventScroll:true});else viewport.focus({preventScroll:true});
    }
    draw(controller.state());onState({...controller.state(),peek});
  };
  const draw=state=>{
    if(disposed||tearingDown)return;
    if(controller&&(!surface.isConnected||one('aui_thread-content')!==content||one('composer-dock')!==dock||surface.querySelector('[data-popped-out]')||!supportedAppearance())){dispose();onState({disabled:true,reason:'Off: host hooks or appearance changed; native state restored'});return}
    const r=bounds.getBoundingClientRect();
    if(!r.width||!r.height)return;
    const g=layout({w:r.width,h:r.height,mode:state.mode,width:state.width,peek});
    surface.style.setProperty('--composer-width',`${g.chatWidth}px`);
    content.style.width=`${g.chatWidth}px`;content.style.marginLeft=`${g.chatLeft}px`;content.style.marginRight='0px';
    dock.style.left=`${g.chatLeft+g.chatWidth/2}px`;dock.style.right='auto';dock.style.transform='translateX(-50%)';
    const focus=state.mode==='focus', L=state.looks[state.mode], narrow=!focus&&!g.wide;
    // Narrow Window Seat puts text over the room, so keep a readability floor there.
    const blur=narrow?Math.max(L.blur,10):L.blur, bright=(narrow?Math.min(L.brightness,60):L.brightness)/100;
    const glass=narrow?Math.max(L.glass,10):L.glass;
    const fx=[blur?`blur(${blur}px)`:'',focus||narrow?'saturate(.5)':'',bright<1?`brightness(${bright})`:''].filter(Boolean).join(' ');
    canvas.style.filter=fx||'none';
    canvas.style.transform=focus&&blur?'scale(1.08)':'none'; // hides blurred edges
    veil.style.backdropFilter=glass?`blur(${glass}px)`:'none';
    // Wide Window Seat: frost only the chat side, never the visible room.
    const mask=g.wide&&!focus?`linear-gradient(to right,transparent ${Math.max(0,g.chatLeft-40)}px,#000 ${g.chatLeft}px)`:'none';
    veil.style.maskImage=mask;veil.style.webkitMaskImage=mask;
    const a=x=>`rgba(20,17,20,${Math.min(1,x*L.veil/100).toFixed(3)})`;
    veil.style.background=focus&&r.width>700?`radial-gradient(ellipse 62% 78% at 50% 48%,${a(1)} 0%,${a(.93)} 45%,${a(.4)} 78%,rgba(20,17,20,0) 100%)`
      :g.wide?`linear-gradient(to right,transparent ${Math.max(0,g.chatLeft-40)}px,${a(1)} ${g.chatLeft}px)`:a(focus?.907:.81);
    if(peek){canvas.style.filter='none';canvas.style.transform='none';veil.style.background='transparent';veil.style.backdropFilter='none';}
    overlay.render(state,g,peek,r);
    // The room is 144 logical px tall. When the pane is taller than the scaled
    // room (wide Window Seat, scaled to the room width), extend the wall upward instead of leaving an
    // empty band: copy the room's top row (plaster stripes, lamp cord) and shade
    // it towards the ceiling. Tint is already applied to the copied row.
    const H=Math.max(144,Math.ceil(r.height/g.scale)), band=H-144;
    canvas.width=g.W;canvas.height=H;canvas.style.width=`${g.W*g.scale}px`;canvas.style.height=`${H*g.scale}px`;
    paint.save();paint.translate(0,band);
    K.draw(paint,g.W,state.clock.hour,frame,{wx:g.wx,tx:g.tx,state:state.motion?'idle':'still'});
    paint.restore();
    if(band>0){
      paint.drawImage(canvas,0,band,g.W,1,0,0,g.W,band);
      const shade=paint.createLinearGradient(0,0,0,band);shade.addColorStop(0,'rgba(10,8,10,.45)');shade.addColorStop(1,'rgba(10,8,10,0)');
      paint.fillStyle=shade;paint.fillRect(0,0,g.W,band);
    }
  };
  const dispose=()=>{
    if(disposed||tearingDown)return;tearingDown=true;
    if(peek)setPeek(false);
    disposed=true;
    controller?.dispose();loop?.dispose();loop=null;for(const fn of off.reverse())fn();
    overlay.dispose();canvas.remove();veil.remove();token.remove();surface.removeAttribute('data-kaffeehaus');for(const fn of restores.reverse())fn();
    onState({disabled:true,reason:'Off. Prior settings restored.'});
  };
  try {
    const report=state=>{
      if(disposed)return;
      if(state.motion && !loop && sdk?.createBudgetedLoop) loop=sdk.createBudgetedLoop(()=>{if(!disposed){frame++;draw(controller.state())}},{fps:4,idleWhen:()=>disposed||!bounds.isConnected});
      if(!state.motion && loop){loop.dispose();loop=null;frame=0;}
      onState({...state,peek,motionSupported:!!sdk?.createBudgetedLoop});
    };
    controller=createController({now,every:(fn,ms)=>ctx.setInterval(fn,ms),draw,onState:report});
    controller.update({reduced:reduced.matches});
    off.push(ctx.addEventListener(reduced,'change',()=>controller.update({reduced:reduced.matches})));
    off.push(ctx.addEventListener(forced,'change',()=>{if(forced.matches)dispose()}));
    const ro=new ResizeObserver(()=>{if(!disposed)draw(controller.state())});ro.observe(bounds);off.push(()=>ro.disconnect());
    off.push(ctx.addEventListener(window,'focus',()=>controller.resume()));
    off.push(ctx.addEventListener(window,'pageshow',()=>controller.resume()));
    off.push(ctx.addEventListener(document,'visibilitychange',()=>{if(!document.hidden)controller.resume()}));
    off.push(ctx.addEventListener(back,'click',()=>setPeek(false)));
    off.push(ctx.addEventListener(back,'keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();setPeek(false)}
      if(event.key==='Tab'){event.preventDefault();back.focus()}
    }));
    ctx.onDispose(dispose);
    return {enabled:true,dispose,state:()=>({...controller.state(),peek}),update:patch=>controller.update({...patch,...(!sdk?.createBudgetedLoop?{motionRequested:false}:{})}),setPeek};
  } catch(error) {dispose();return refused(`Mount failed: ${error.message}`)}
}
