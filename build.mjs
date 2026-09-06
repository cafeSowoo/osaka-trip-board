import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const root=new URL('./',import.meta.url);
let html=await readFile(new URL('src/shell.html',root),'utf8');
for(const [token,path] of [['STYLE','src/style.css'],['MODEL','src/model.js'],['APP','src/app.js']]){
  const content=await readFile(new URL(path,root),'utf8');
  if(token!=='STYLE'&&/<\/script/i.test(content))throw new Error('Unsafe inline script terminator in '+path);
  html=html.replace('/*__'+token+'__*/',()=>content);
}
await writeFile(new URL('index.html',root),html);
console.log('Built '+fileURLToPath(new URL('index.html',root))+' ('+Buffer.byteLength(html)+' bytes)');
