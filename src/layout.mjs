// Geometry is an experimental adapter, not a Desktop SDK promise.
export function layout({w,h,mode,width,peek=false}) {
  // Window Seat treats reading width as a maximum: it narrows the text (not below
  // 360px) so the room (>=420px) stays beside it instead of falling back to the overlay.
  let chatWidth = Math.max(0, Math.min(width, w-32));
  if (mode==='window' && !peek && w-62-420>=360) chatWidth = Math.min(chatWidth, w-62-420);
  const room = w-chatWidth-62;
  const wide = mode === 'window' && room/140>=3 && h/144>=3;
  const scale = peek ? Math.max(.1, Math.min(h/144,(w-24)/144))
    : wide ? Math.min(h/144,room/140) : Math.max(.1,h/144);
  const W = Math.ceil(w/scale);
  let wx,tx;
  if (peek) { wx=Math.round(W/2)-14; tx=wx+14; }
  else if (mode==='focus') { wx=Math.round(W*(w>700?.17:.5)); tx=Math.round(W*(w>700?.84:.5)); }
  else { wx=Math.round((wide?room:w)/2/scale)-14; tx=wx+14; }
  return {height:h,chatWidth,chatLeft:wide?w-22-chatWidth:(w-chatWidth)/2,
    wide,scale,W,wx,tx, artLeft:(wx-54)*scale,artRight:(wx+82)*scale};
}
