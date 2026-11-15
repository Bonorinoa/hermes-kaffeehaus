// The note-taker's state machine. Inputs are content-free: two booleans from the
// public Desktop SDK (Hermes is working / still waiting for the first words), the
// local hour, and whether motion is allowed. It never sees what anyone wrote.
// One step per animation frame (about 4 per second).
export const CHARACTER = Object.freeze({
  lookup: 10,        // frames looking up when the first words arrive (2.5 s)
  wrapup: 16,        // closing the notebook and a sip (4 s)
  rest: 40,          // holding the closed-notebook pose before idling (10 s)
  dozeAfter: 2400,   // idle frames before dozing late at night (10 min)
  sleepAfter: 2400,  // dozing frames before the sleeping bag comes out (10 min)
});
const late = h => h >= 23 || h < 5;      // dozing hours
const veryLate = h => h >= 1 && h < 5;   // sleeping-bag hours (rare on purpose)

export function createCharacter(T = CHARACTER) {
  let state = 'idle', since = 0, idle = 0, wasBusy = false, wasAwaiting = false;
  const go = next => { if (next !== state) { state = next; since = 0; } };
  return {
    get: () => ({ state, since }),
    step({ busy = false, awaiting = false, hour = 12, motion = true } = {}) {
      since++;
      if (busy) {
        idle = 0;
        if (state === 'doze' || state === 'sleep' || state === 'idle' || state === 'wrapup' || state === 'still') go('busy');
        if (wasAwaiting && !awaiting && state === 'busy') go('lookup');   // the first words arrive
        if (state === 'lookup' && since >= T.lookup) go('busy');
      } else {
        if (wasBusy) go('wrapup');                                        // the turn ended
        else if (state === 'busy' || state === 'lookup') go('idle');
        if (state === 'wrapup' && since >= T.wrapup + T.rest) go('idle');
        if (state === 'idle' || state === 'still') idle++;
        if (state === 'idle' && late(hour) && idle >= T.dozeAfter) go('doze');
        if (state === 'doze' && veryLate(hour) && since >= T.sleepAfter) go('sleep');
        if ((state === 'doze' || state === 'sleep') && !late(hour)) go('idle'); // morning
      }
      wasBusy = busy; wasAwaiting = busy && awaiting;
      return { state: motion ? state : 'still', since: motion ? since : 0 };
    },
  };
}
