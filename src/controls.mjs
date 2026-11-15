import { mountScene } from './scene.mjs';
import { DEFAULT_LOOKS, LOOK_RANGES } from './controller.mjs';

export function mountControls(container,ctx,sdk) {
  let scene=null,disposed=false;
  const off=[], nodes={};
  const form=document.createElement('div');form.style.cssText='display:flex;flex-wrap:wrap;gap:10px;align-items:center;color:var(--ui-text-primary);font:14px/1.5 system-ui';
  const add=(tag,key,text)=>{const n=document.createElement(tag);n.dataset.kh=key;if(text)n.textContent=text;nodes[key]=n;form.append(n);return n};
  const label=(name,node)=>{const l=document.createElement('label');l.textContent=name+' ';l.append(node);form.append(l)};
  const select=add('select','mode');for(const [value,text] of [['focus','Focus'],['window','Window Seat']]){const o=document.createElement('option');o.value=value;o.textContent=text;select.append(o)}label('Mode',select);
  const width=add('input','width');width.type='range';width.min='360';width.max='1000';width.step='10';width.value='780';label('Reading width (px)',width);
  const hour=add('input','hour');hour.type='range';hour.min='0';hour.max='23.99';hour.step='.01';hour.value='12';label('Manual civil hour',hour);
  // Look sliders edit the active mode only; values are kept per mode in memory.
  const LOOK_LABELS=[['blur','Scene blur','px'],['brightness','Scene brightness','%'],['veil','Text panel opacity','%'],['glass','Glass blur','px']];
  let looks={focus:{...DEFAULT_LOOKS.focus},window:{...DEFAULT_LOOKS.window}};
  const lookInputs={},lookReadouts={};
  for(const [key,name,unit] of LOOK_LABELS){
    const n=add('input','look-'+key);n.type='range';[n.min,n.max]=LOOK_RANGES[key].map(String);n.step='1';n.value=String(looks.focus[key]);
    const out=document.createElement('output');out.textContent=`${n.value}${unit}`;lookReadouts[key]=[out,unit];
    const l=document.createElement('label');l.textContent=name+' ';l.append(n,' ',out);form.append(l);lookInputs[key]=n;
  }
  const showLook=mode=>{for(const [key] of LOOK_LABELS){const v=String(looks[mode][key]);if(lookInputs[key].value!==v)lookInputs[key].value=v;const [out,unit]=lookReadouts[key];out.textContent=`${v}${unit}`}};
  const resetLook=add('button','reset-look','Reset look');
  const follow=add('button','follow','Follow local time');
  const motion=add('button','motion','Motion off');
  const peek=add('button','peek','Peek at room');
  const apply=add('button','apply','Apply to one chat (experimental)');
  const stop=add('button','off','Off / restore');
  const status=add('span','status','Off. Click Apply to start. Experimental: relies on Hermes internals that may change.');status.setAttribute('role','status');
  const note=add('span','note','Runs entirely on your Mac: no network, no storage, never reads your chats. Inspired by Borealis.');
  for(const n of form.querySelectorAll('button,input,select'))n.style.cssText='color:inherit;background:var(--ui-panel-background,var(--ui-chat-surface-background));border:1px solid var(--ui-stroke-secondary);padding:6px;border-radius:4px;max-width:100%';
  for(const n of form.querySelectorAll('button'))n.type='button';
  container.append(form);
  const say=text=>{if(status.textContent!==text)status.textContent=text};
  const report=s=>{
    if(disposed)return;
    if(s.disabled){say(s.reason);motion.textContent='Motion off';motion.setAttribute('aria-pressed','false');peek.textContent='Peek at room';peek.setAttribute('aria-pressed','false');follow.setAttribute('aria-pressed','false');return}
    // Live region describes state, not a ticking clock. The hour slider remains
    // an ordinary labeled control; time samples must not re-announce status.
    if(select.value!==s.mode)select.value=s.mode; // keep the side pane in sync with in-scene controls
    if(s.looks){looks={focus:{...s.looks.focus},window:{...s.looks.window}};showLook(s.mode)}
    say(`${s.mode==='window'?'Window Seat':'Focus'} · ${s.clock.mode} · motion ${s.motion?'on':'off'}${s.reduced?' (OS reduced motion)':''} · ${s.motionRequested?'manual request':'manual off'} · ${s.peek?'room peek':'chat'}`);
    follow.setAttribute('aria-pressed',String(s.clock.mode==='auto'));
    motion.textContent=s.motion?'Motion on':'Motion off';motion.setAttribute('aria-pressed',String(s.motion));
    peek.textContent=s.peek?'Back to chat':'Peek at room';peek.setAttribute('aria-pressed',String(!!s.peek));
  };
  const listen=(n,type,fn)=>off.push(ctx.addEventListener(n,type,fn));
  const update=patch=>{if(scene?.enabled)scene.update(patch)};
  listen(select,'change',()=>update({mode:select.value}));listen(width,'input',()=>update({width:Number(width.value)}));
  listen(hour,'input',()=>update({overrideHour:Number(hour.value)}));listen(follow,'click',()=>update({overrideHour:null}));
  for(const [key] of LOOK_LABELS)listen(lookInputs[key],'input',()=>{
    const mode=select.value;looks[mode]={...looks[mode],[key]:Number(lookInputs[key].value)};showLook(mode);update({look:{[key]:looks[mode][key]}});
  });
  listen(resetLook,'click',()=>{const mode=select.value;looks[mode]={...DEFAULT_LOOKS[mode]};showLook(mode);update({look:looks[mode]})});
  listen(select,'change',()=>showLook(select.value));
  listen(motion,'click',()=>{if(scene?.enabled)update({motionRequested:!scene.state().motionRequested})});
  listen(peek,'click',()=>{if(scene?.enabled)scene.setPeek(!scene.state().peek)});
  listen(stop,'click',()=>{scene?.dispose();scene=null;report({disabled:true,reason:'Off. Prior settings restored.'})});
  listen(apply,'click',()=>{
    scene?.dispose();scene=null;
    const surfaces=[...document.querySelectorAll('[data-chat-surface]')];
    if(surfaces.length!==1){say('Not applied: requires exactly one chat surface. Split panes stay native.');return}
    scene=mountScene(surfaces[0],ctx,sdk,{onState:report});
    if(scene.enabled)scene.update({mode:select.value,width:Number(width.value),looks});else say('Not applied: '+scene.reason);
  });
  const dispose=()=>{if(disposed)return;scene?.dispose();disposed=true;off.reverse().forEach(fn=>fn());form.remove()};
  ctx.onDispose(dispose);return {dispose};
}
