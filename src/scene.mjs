import { createController } from './controller.mjs';
import { layout } from './layout.mjs';
import { createOverlay } from './overlay.mjs';
import { createCharacter } from './character.mjs';
import { SCENE, PALETTE_KEYS } from './scenes.mjs';

const DUR = 360; // ms for seat changes; reduced motion snaps
const ease = t => t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;

let sceneSerial = 0;
// All selectors below are private host hooks. No content or session ids are read; the only
// host state read is the public SDK's two booleans host.state.busy / awaitingResponse.
export function mountScene(surface, ctx, sdk, {now = () => new Date(), onState = () => {}} = {}) {
  const refused = reason => ({enabled:false,reason,dispose() {}});
  if (!surface?.matches('[data-chat-surface]') || !surface.isConnected || surface.hasAttribute('data-scenes')) return refused('Unavailable or already owned chat surface');
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
  const token=document.createElement('span');token.setAttribute('aria-hidden','true');token.dataset.scenesProbe='';
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
  // Classic: the active scene's palette, scoped to this chat surface through Hermes's own theme variables.
  const PALETTE=SCENE.palette;
  const KEYS=PALETTE_KEYS;
  const native={composer:surface.style.getPropertyValue('--composer-width'),width:content.style.width,ml:content.style.marginLeft,mr:content.style.marginRight,
    left:dock.style.left,right:dock.style.right,transform:dock.style.transform,translate:dock.style.translate,font:content.style.fontFamily,pad:content.style.paddingTop,palette:{}};
  for(const k of KEYS)native.palette[k]=surface.style.getPropertyValue(k);
  const id=`kh-${++sceneSerial}`;surface.setAttribute('data-scenes',id);
  own(surface,'--composer-width','780px');own(bounds,'background-color','transparent');own(bounds,'isolation','isolate');
  for (const p of ['width','margin-left','margin-right']) own(content,p,content.style.getPropertyValue(p));
  for (const p of ['left','right','transform','translate']) own(dock,p,dock.style.getPropertyValue(p));
  own(content,'font-family',native.font);own(content,'padding-top',native.pad);for(const k of KEYS)own(surface,k,native.palette[k]);
  // Tailwind 4 uses individual translate; it composes with transform. Own both
  // mechanisms while mounted, then restore each original value and priority.
  dock.style.translate='none';
  const veil=document.createElement('div');veil.setAttribute('aria-hidden','true');
  veil.style.cssText='position:absolute;inset:0;z-index:-1;pointer-events:none';
  canvas.setAttribute('aria-hidden','true');canvas.dataset.scenesCanvas='';
  canvas.style.cssText='position:absolute;left:0;bottom:0;pointer-events:none;image-rendering:pixelated;z-index:-2';
  bounds.prepend(canvas,veil);surface.append(token); // keep the appearance probe mounted: no per-frame DOM churn
  const back=document.createElement('button');back.type='button';back.textContent='Back to chat';back.dataset.scenesBack='';
  back.style.cssText='position:absolute;top:12px;right:12px;z-index:50;padding:10px 16px;color:var(--ui-text-primary);background:var(--ui-panel-background,var(--ui-chat-surface-background));border:2px solid var(--ui-stroke-secondary);border-radius:6px';
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  // In-scene controls (menu board / glass pill). Errors from bad patches are ignored, never thrown into the app.
  const overlay=createOverlay({root:bounds,listen:(n,t,f)=>off.push(ctx.addEventListener(n,t,f)),update:patch=>{try{if(!disposed)controller.update(sdk?.createBudgetedLoop?patch:{...patch,motionRequested:false})}catch{}},
    peek:()=>setPeek(true),reduced:()=>reduced.matches});
  let loop=null, frame=0;
  // The note-taker follows only whether Hermes is working, never what was said.
  const character=createCharacter(), host=sdk?.host?.state;
  const flag=a=>{try{return !!a?.get?.()}catch{return false}};
  let act={state:'still',since:0};
  // Seat changes: the old picture fades out over the new one, and the chat column eases into place.
  let shown=null, tween=null; const ghosts=new Set();
  const fade=()=>{
    if(reduced.matches)return;
    const g=[];
    if(canvas.style.display!=='none'&&canvas.width){const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;c.getContext('2d')?.drawImage(canvas,0,0);c.style.cssText=canvas.style.cssText;c.style.zIndex='-1';g.push(c)}
    const v=veil.cloneNode(false);g.push(v);
    for(const n of g){n.setAttribute('aria-hidden','true');n.style.transition=`opacity ${DUR}ms ease`;n.style.opacity='1';ghosts.add(n)}
    veil.after(...g);void veil.offsetWidth;for(const n of g)n.style.opacity='0';
    const t=setTimeout(()=>{for(const n of g){n.remove();ghosts.delete(n)}},DUR+80);off.push(()=>clearTimeout(t));
  };
  const geo=s=>{
    if(s.native){surface.style.setProperty('--composer-width',native.composer);content.style.width=native.width;content.style.marginLeft=native.ml;content.style.marginRight=native.mr;
      dock.style.left=native.left;dock.style.right=native.right;dock.style.transform=native.transform;dock.style.translate=native.translate;content.style.paddingTop='52px';return}
    surface.style.setProperty('--composer-width',`${s.chatWidth}px`);content.style.width=`${s.chatWidth}px`;content.style.marginLeft=`${s.chatLeft}px`;content.style.marginRight='0px';
    dock.style.left=`${s.chatLeft+s.chatWidth/2}px`;dock.style.right='auto';dock.style.transform='translateX(-50%)';dock.style.translate='none';if(!s.mid)content.style.paddingTop=native.pad;
  };
  const rel=()=>{const a=content.getBoundingClientRect(),b=bounds.getBoundingClientRect();return {chatLeft:a.left-b.left,chatWidth:a.width}};
  const place=(s,animate)=>{
    if(tween){tween.s=s;return}
    if(!animate||reduced.matches)return geo(s);
    const from=rel();geo(s);const to=rel();
    if(Math.abs(from.chatLeft-to.chatLeft)<2&&Math.abs(from.chatWidth-to.chatWidth)<2)return;
    tween={s,start:performance.now()};geo({...from,mid:true});content.style.paddingTop=s.native?'52px':native.pad; // padding goes first: no pop on the last frame
    const step=now=>{
      if(disposed||!tween)return;
      const t=Math.min(1,(now-tween.start)/DUR),e=ease(t);
      if(t>=1){const last=tween.s;tween=null;geo(last);return}
      geo({mid:true,chatLeft:from.chatLeft+(to.chatLeft-from.chatLeft)*e,chatWidth:from.chatWidth+(to.chatWidth-from.chatWidth)*e});requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
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
    // Inactive tabs stay mounted. A scene on one of them is no longer the chat on screen.
    if(controller&&surface.closest('[data-pane-hidden]')){dispose();onState({disabled:true,reason:'Off: that chat is no longer on screen. Open it again on the chat you are reading.'});return}
    if(controller&&(!surface.isConnected||one('aui_thread-content')!==content||one('composer-dock')!==dock||surface.querySelector('[data-popped-out]')||!supportedAppearance())){dispose();onState({disabled:true,reason:'Off: host hooks or appearance changed; native state restored'});return}
    const r=bounds.getBoundingClientRect();
    if(!r.width||!r.height)return;
    const classic=state.mode==='classic'&&!peek;
    const mode=state.mode==='classic'?'focus':state.mode; // peek from Classic shows the room as Focus does
    const g=layout({w:r.width,h:r.height,mode,width:state.width,peek});
    const key=classic?'classic':`${mode}|${peek}|${g.wide}`, changed=shown!==null&&shown!==key;
    if(changed)fade();
    shown=key;
    for(const k of KEYS)surface.style.setProperty(k,classic&&k in PALETTE?PALETTE[k]:native.palette[k]);
    content.style.fontFamily=classic?'"Iowan Old Style",Palatino,"Times New Roman",Georgia,serif':native.font;
    if(classic){
      // Hermes's own geometry (plus room for the pill); the ground is the house palette instead of the room.
      place({native:true},changed);
      canvas.style.display='none';veil.style.backdropFilter='none';veil.style.maskImage=veil.style.webkitMaskImage='none';
      veil.style.background='radial-gradient(110% 70% at 0% 0%,rgba(122,34,40,.30),rgba(122,34,40,0) 60%),radial-gradient(80% 60% at 100% 100%,rgba(201,163,106,.07),rgba(201,163,106,0) 70%),linear-gradient(180deg,#221a17,#171315)';
      overlay.render({...state,motionSupported:!!sdk?.createBudgetedLoop},layout({w:r.width,h:r.height,mode:'focus',width:state.width,peek}),peek,r);
      return;
    }
    canvas.style.display='';
    place({chatLeft:g.chatLeft,chatWidth:g.chatWidth},changed);
    const focus=mode==='focus', L=state.looks[mode], narrow=!focus&&!g.wide;
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
    overlay.render({...state,motionSupported:!!sdk?.createBudgetedLoop},g,peek,r);
    // The room is 144 logical px tall. When the pane is taller than the scaled
    // room (wide Window Seat, scaled to the room width), extend the wall upward instead of leaving an
    // empty band: copy the room's top row (plaster stripes, lamp cord) and shade
    // it towards the ceiling. Tint is already applied to the copied row.
    const H=Math.max(144,Math.ceil(r.height/g.scale)), band=H-144;
    canvas.width=g.W;canvas.height=H;canvas.style.width=`${g.W*g.scale}px`;canvas.style.height=`${H*g.scale}px`;
    paint.save();paint.translate(0,band);
    ART[SCENE.id].draw(paint,g.W,state.clock.hour,frame,{wx:g.wx,tx:g.tx,state:state.motion?act.state:'still',since:act.since});
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
    tween=null;for(const n of ghosts)n.remove();ghosts.clear();
    overlay.dispose();canvas.remove();veil.remove();token.remove();surface.removeAttribute('data-scenes');for(const fn of restores.reverse())fn();
    onState({disabled:true,reason:'Off. Prior settings restored.'});
  };
  try {
    const report=state=>{
      if(disposed)return;
      if(state.motion && !loop && sdk?.createBudgetedLoop) loop=sdk.createBudgetedLoop(()=>{if(!disposed){const s=controller.state();frame++;act=character.step({busy:flag(host?.busy),awaiting:flag(host?.awaitingResponse),hour:s.clock.hour,motion:s.motion});draw(s)}},{fps:4,idleWhen:()=>disposed||!bounds.isConnected});
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
