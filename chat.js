const {createChatHandler}=require('../../chat.cjs');
const handler=createChatHandler();
// Netlify's Lambda-compatible adapter keeps the Google Gemini key in environment variables.
exports.handler=async event=>{
  const {Readable}=require('node:stream');
  const req=Readable.from([Buffer.from(event.body||'',event.isBase64Encoded?'base64':'utf8')]);
  req.method=event.httpMethod;req.headers=Object.fromEntries(Object.entries(event.headers||{}).map(([k,v])=>[k.toLowerCase(),v]));
  let status=200,headers={};let body='';
  const res={setHeader(k,v){headers[k]=v;},writeHead(s,h){status=s;Object.assign(headers,h);},end(value){body=value||'';}};
  await handler(req,res);return {statusCode:status,headers,body};
};
