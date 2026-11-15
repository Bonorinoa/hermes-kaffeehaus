import * as sdk from '@hermes/plugin-sdk';
import { createElement, useEffect, useRef } from 'react';
import { createSession, mountControls } from './controls.mjs';

const plugin={id:'hermes-kaffeehaus',name:'Kaffeehaus',defaultEnabled:false,
 description:'A time-aware pixel café behind your Hermes chat. Local only; experimental.',
 register(ctx){
  const session=createSession(ctx,sdk); // outlives the tab: hiding the sidebar keeps the scene
  function Controls(){const ref=useRef(null);useEffect(()=>{const c=mountControls(ref.current,ctx,session);return ()=>c.dispose()},[]);return createElement('div',{ref,style:{padding:12,overflow:'auto',height:'100%'}})}
  ctx.register({id:'controls',area:'panes',title:'Kaffeehaus',data:{placement:'right',width:'320px'},render:()=>createElement(Controls)});
  // ⌘K rows, so the café can be opened or closed (and the tab brought back) after the tab is closed.
  ctx.register({id:'toggle',area:'palette',data:{label:'Kaffeehaus café',keywords:['kaffeehaus','cafe','coffee','scene','ambient'],
   detail:()=>session.scene?'on':'off',detailVariant:'state',run:()=>session.scene?session.off():session.apply(session.prefs())}});
  ctx.register({id:'tab',area:'palette',data:{label:'Kaffeehaus: show the tab',keywords:['kaffeehaus','cafe','pane'],
   run:()=>{try{sdk.host?.revealPane?.('hermes-kaffeehaus:controls')}catch{}}}});
 }};
export default plugin;
