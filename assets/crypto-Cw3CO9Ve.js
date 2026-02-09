async function o(r){const a=new TextEncoder().encode(r),t=await crypto.subtle.digest("SHA-256",a);return Array.from(new Uint8Array(t)).map(s=>s.toString(16).padStart(2,"0")).join("")}export{o as s};
