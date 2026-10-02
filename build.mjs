import fs from 'node:fs';
const assets={};
for(const [name,type]of [['index.html','text/html; charset=utf-8'],['app.js','text/javascript; charset=utf-8'],['style.css','text/css; charset=utf-8']])assets['/'+name]={content:fs.readFileSync(new URL('./dist/'+name,import.meta.url),'utf8'),type};
const server=fs.readFileSync(new URL('./server.mjs',import.meta.url),'utf8');
fs.mkdirSync(new URL('./dist/server/',import.meta.url),{recursive:true});
fs.writeFileSync(new URL('./dist/server/index.js',import.meta.url),server+'\nexport default createHandler('+JSON.stringify(assets)+');\n');
console.log('Built website with live university discovery.');
