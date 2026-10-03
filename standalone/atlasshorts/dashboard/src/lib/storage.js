const PREFIX = 'atlasshorts:';
function namespaced(kind) {
 const store = () => window[kind];
 return { getItem:key=>store().getItem(PREFIX+key), setItem:(key,value)=>store().setItem(PREFIX+key,value), removeItem:key=>store().removeItem(PREFIX+key), clear:()=>{ const s=store(); for(const key of Object.keys(s)) if(key.startsWith(PREFIX)) s.removeItem(key); } };
}
export const atlasLocalStorage = namespaced('localStorage');
export const atlasSessionStorage = namespaced('sessionStorage');
