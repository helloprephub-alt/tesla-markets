type Req={method?:string;query?:Record<string,string|string[]|undefined>};
type Res={setHeader:(name:string,value:string)=>void;status:(code:number)=>Res;send:(body:string|Uint8Array)=>void};
const hosts=new Set(['digitalassets-shop.tesla.com','digitalassets-shop.tesla.cn','www.eco-worthy.com']);
export default async function handler(req:Req,res:Res):Promise<void>{
 if(req.method!=='GET'&&req.method!=='HEAD'){res.setHeader('Allow','GET, HEAD');res.status(405).send('Method not allowed');return;}
 const raw=typeof req.query?.url==='string'?req.query.url:'';
 let target:URL;try{target=new URL(raw);}catch{res.status(400).send('Invalid image URL');return;}
 if(target.protocol!=='https:'||!hosts.has(target.hostname)){res.status(403).send('Image host not allowed');return;}
 if(target.hostname.startsWith('digitalassets-shop.')&&!target.pathname.startsWith('/image/upload/')){res.status(403).send('Image path not allowed');return;}
 if(target.hostname==='www.eco-worthy.com'&&!target.pathname.startsWith('/cdn/shop/files/')){res.status(403).send('Image path not allowed');return;}
 try{
  const upstream=await fetch(target.toString(),{headers:{'Accept':'image/avif,image/webp,image/apng,image/*,*/*;q=0.8','Referer':target.hostname==='www.eco-worthy.com'?'https://www.eco-worthy.com/':'https://shop.tesla.com/','User-Agent':'Mozilla/5.0 (compatible; TeslaMarketsProductImage/1.0)'},redirect:'follow'});
  if(!upstream.ok){res.status(502).send('Image source returned '+upstream.status);return;}
  const type=upstream.headers.get('content-type')||'';if(!type.startsWith('image/')){res.status(502).send('Source did not return an image');return;}
  const bytes=new Uint8Array(await upstream.arrayBuffer());res.setHeader('Content-Type',type);res.setHeader('Cache-Control','public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400');res.setHeader('X-Content-Type-Options','nosniff');res.status(200).send(bytes);
 }catch{res.status(502).send('Image could not be loaded');}
}