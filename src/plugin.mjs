import * as sdk from '@hermes/plugin-sdk';
import { createElement, useEffect, useRef } from 'react';
import { createSession, mountControls } from './controls.mjs';
import { SCENE } from './scenes.mjs';

const plugin={id:'scenes',name:'Scenes',defaultEnabled:false,
 description:'Living scenes behind your Hermes chat. Skins change the colours; scenes change the place. Local only; experimental.',
 register(ctx){
  const session=createSession(ctx,sdk); // outlives the tab: hiding the sidebar keeps the scene
  function Controls(){const ref=useRef(null);useEffect(()=>{const c=mountControls(ref.current,ctx,session);return ()=>c.dispose()},[]);return createElement('div',{ref,style:{padding:12,overflow:'auto',height:'100%'}})}
  ctx.register({id:'controls',area:'panes',title:'Scenes',data:{placement:'right',width:'320px'},render:()=>createElement(Controls)});
  // ⌘K rows, so the scene can be opened or closed (and the tab brought back) after the tab is closed.
  ctx.register({id:'toggle',area:'palette',data:{label:`Scenes: ${SCENE.name}`,keywords:['scenes','scene',SCENE.id,'cafe','coffee','ambient','workspace'],
   detail:()=>session.live()?'on':'off',detailVariant:'state',run:()=>session.toggle(session.prefs())}});
  ctx.register({id:'tab',area:'palette',data:{label:'Scenes: show the tab',keywords:['scenes','scene','pane'],
   run:()=>{try{sdk.host?.revealPane?.('scenes:controls')}catch{}}}});
 }};
export default plugin;
