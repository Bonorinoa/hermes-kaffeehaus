import * as sdk from '@hermes/plugin-sdk';
import { createElement, useEffect, useRef } from 'react';
import { mountControls } from './controls.mjs';

const plugin={id:'hermes-kaffeehaus',name:'Kaffeehaus',defaultEnabled:false,
 description:'A time-aware pixel café behind your Hermes chat. Local only; experimental.',
 register(ctx){
  function Controls(){const ref=useRef(null);useEffect(()=>{const c=mountControls(ref.current,ctx,sdk);return ()=>c.dispose()},[]);return createElement('div',{ref,style:{padding:12,overflow:'auto',height:'100%'}})}
  ctx.register({id:'controls',area:'panes',title:'Kaffeehaus',data:{placement:'right',width:'320px'},render:()=>createElement(Controls)});
 }};
export default plugin;
