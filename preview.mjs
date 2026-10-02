import http from 'node:http';
import fs from 'node:fs';
import {createHandler} from './server.mjs';
const types={'html':'text/html','js':'text/javascript','css':'text/css'};
const assets={};for(const name of ['index.html','app.js','style.css'])assets['/'+name]={content:fs.readFileSync(new URL('./dist/'+name,import.meta.url),'utf8'),type:types[name.split('.').pop()]};
const app=createHandler(assets);
const port=Number(process.env.PORT||4175);
http.createServer(async(req,res)=>{try{let body; if(!['GET','HEAD'].includes(req.method)){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1000000){res.writeHead(413).end('Request too large');return;}chunks.push(chunk);}body=Buffer.concat(chunks);}const response=await app.fetch(new Request('http://127.0.0.1:'+port+req.url,{method:req.method,headers:req.headers,body}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{res.writeHead(500).end('Unable to serve the website.');}}).listen(port,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+port));

