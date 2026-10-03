import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
const backend=process.env.VITE_PROXY_TARGET||'http://backend:8000';
const proxy=Object.fromEntries(['/api','/mcp','/videos','/thumbnails','/gallery','/video','/health'].map(p=>[p,{target:backend,changeOrigin:true}]));
proxy['/render']={target:process.env.VITE_RENDER_TARGET||'http://renderer:3100',changeOrigin:true};
export default defineConfig({plugins:[react()],server:{host:'127.0.0.1',proxy},preview:{host:'127.0.0.1',proxy}});
