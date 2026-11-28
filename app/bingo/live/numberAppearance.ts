import {roundTheme} from '../roundColors';

/** Presentation only: 28% white over the round hue; ink stays at least 4.5:1. */
export function unseenNumberAppearance(background:string){
 roundTheme(background); // Validate before reading RGB channels.
 const surface='#'+[1,3,5].map(i=>Math.round(parseInt(background.slice(i,i+2),16)*.72+255*.28).toString(16).padStart(2,'0')).join('');
 return {...roundTheme(surface)};
}
