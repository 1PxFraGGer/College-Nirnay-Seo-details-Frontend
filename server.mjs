const SHEET='1aTyJN0KQRLuGt96aPSGGGV8I8-KVqQmhut07MVEvook';
export function parseUniversities(html){
  const decode=s=>s.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi,(_,entity)=>{
    if(entity[0]==='#'){const code=entity[1].toLowerCase()==='x'?parseInt(entity.slice(2),16):parseInt(entity.slice(1),10);return code<=0x10ffff?String.fromCodePoint(code):'';}
    return {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '}[entity.toLowerCase()];
  });
  return [...new Set([...html.matchAll(/class="[^"]*\bdocs-sheet-tab-caption\b[^"]*"[^>]*>([^<]*)</g)].map(x=>decode(x[1]).trim()).filter(Boolean))];
}
export async function universityResponse(fetcher=fetch){
  try{
    const response=await fetcher(`https://docs.google.com/spreadsheets/d/${SHEET}/edit?_= ${Date.now()}`.replace('= ','='),{signal:AbortSignal.timeout(20000),headers:{'Cache-Control':'no-cache'}});
    if(!response.ok)throw new Error('The Google Sheet is not accessible. Keep its sharing set to Anyone with the link — Viewer.');
    const names=parseUniversities(await response.text());
    if(!names.length)throw new Error('No university tabs could be read from the Google Sheet. Please try again.');
    return Response.json(names,{headers:{'Cache-Control':'no-store'}});
  }catch(error){return Response.json({error:error.message||'Unable to read university tabs.'},{status:502,headers:{'Cache-Control':'no-store'}});}
}
export async function editorResponse(request,fetcher=fetch){
  const reply=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
  try{
    // Reject cross-origin form submissions; editor credentials only travel in JSON bodies.
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return reply({error:'JSON request required.'},415);
    const origin=request.headers.get('Origin');
    if(origin && origin!==new URL(request.url).origin)return reply({error:'Invalid request origin.'},403);
    const text=await request.text();if(text.length>1000000)return reply({error:'Request too large.'},413);
    const input=JSON.parse(text);
    if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(input.endpoint||''))return reply({error:'Enter a valid Google Apps Script deployment URL ending in /exec.'},400);
    if(typeof input.key!=='string'||input.key.length<32||input.key.length>512)return reply({error:'Enter your editor key (at least 32 characters).'},400);
    if(!['list','read','save','addUniversity','addPage','addField'].includes(input.action))return reply({error:'Invalid action.'},400);
    const {endpoint,...payload}=input;
    const response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),redirect:'follow',signal:AbortSignal.timeout(60000)});
    if(!response.ok)return reply({error:'Google could not complete the request. Check the deployment access settings.'},502);
    let result;try{result=await response.json();}catch{return reply({error:'The connection did not return data. Deploy the script as a web app with access set to Anyone.'},502);}
    if(!result.ok)return reply({error:result.error||'Google Sheets rejected the request.'},400);
    if(result.spreadsheetId!==SHEET)return reply({error:'This editor is connected to a different spreadsheet.'},400);
    return reply(result);
  }catch{return reply({error:'Unable to confirm the Google Sheets request. Refresh data to check its result before trying again.'},502);}
}
export function createHandler(assets){return {async fetch(request){
  const pathname=new URL(request.url).pathname;
  if(pathname==='/api/editor'){
    if(request.method!=='POST')return new Response('Method not allowed',{status:405});
    return editorResponse(request);
  }
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  if(pathname==='/api/universities')return universityResponse();
  const asset=assets[pathname==='/'?'/index.html':pathname];
  if(!asset)return new Response('Not found',{status:404});
  return new Response(request.method==='HEAD'?null:asset.content,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache'}});
}};}
