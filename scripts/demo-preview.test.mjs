import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyEmailGate,sharingEmails,validateEmails,parseTunnelUrl,validateState,isEmailGate} from './demo-preview.mjs';
test('sharing requires exact emails, rejects wildcards, missing values and shell-like input',()=>{
 assert.equal(validateEmails('Albert@example.com,guest@example.com,albert@example.com'),'albert@example.com,guest@example.com');
 for(const v of ['', '*@example.com','a@example.com,bad','x;echo pwned','--url','x@example.com\n--url http://evil']) assert.throws(()=>validateEmails(v));
});
test('only a provider-issued HTTPS hostname is accepted',()=>{
 assert.equal(parseTunnelUrl('https://abc-123.trycloudflare.com'),'https://abc-123.trycloudflare.com');
 assert.equal(parseTunnelUrl('http://abc.trycloudflare.com'),null);
 assert.equal(parseTunnelUrl('https://evil.example'),null);
 const valid={PREVIEW_DB_PASSWORD:'a'.repeat(64),PREVIEW_JWT_SECRET:'b'.repeat(64),PREVIEW_UPLOAD_SECRET:'c'.repeat(64),PREVIEW_WEB_URL:'https://abc.trycloudflare.com',PREVIEW_COOKIE_SECURE:'true'};
 assert.equal(validateState(valid),valid);
 assert.throws(()=>validateState({...valid,PREVIEW_WEB_URL:'https://abc.trycloudflare.com.evil.example'}));
 assert.throws(()=>validateState({...valid,PREVIEW_UPLOAD_SECRET:valid.PREVIEW_JWT_SECRET}));
});
test('public gate check rejects exposed app and generic failure pages',()=>{
 assert.equal(isEmailGate(200,null,'<div id="root"></div>'),false);
 assert.equal(isEmailGate(500,null,'failed'),false);
 assert.equal(isEmailGate(302,'http://evil.example',''),false);
 assert.equal(isEmailGate(302,'https://team.cloudflareaccess.com/login',''),true);
 assert.equal(isEmailGate(200,null,'Cloudflare: enter email and verification code'),true);
 assert.equal(isEmailGate(403,null,''),true);
});

test('email arguments work with Windows npm forwarding and direct Node invocation',()=>{
 assert.equal(sharingEmails(['owner@example.com']),'owner@example.com');
 assert.equal(sharingEmails(['--emails','owner@example.com,guest@example.com']),'owner@example.com,guest@example.com');
 for(const args of [[],['--emails'],['--emails','a@example.com','extra'],['--url','https://evil.example']]) assert.throws(()=>sharingEmails(args));
});

test('relative provider login redirects are allowed only on the issued HTTPS origin',()=>{
 assert.equal(isEmailGate(302,'/cdn-cgi/access/login','', 'https://abc.trycloudflare.com'),true);
 assert.equal(isEmailGate(302,'https://evil.example/cdn-cgi/access/login','', 'https://abc.trycloudflare.com'),false);
});
test('external probe retries tunnel warmup and accepts a subsequent protected redirect',async()=>{
 let calls=0;const logs=[];
 await verifyEmailGate('https://abc.trycloudflare.com',{fetchImpl:async()=>++calls===1?new Response('starting',{status:503}):new Response('',{status:302,headers:{location:'/cdn-cgi/access/login?token=secret'}}),pauseImpl:async()=>{},log:v=>logs.push(v)});
 assert.equal(calls,2);assert.ok(logs.every(v=>!v.includes('secret')));
});
test('external probe rejects exposed app immediately and never prints body',async()=>{
 let calls=0;const logs=[];
 await assert.rejects(verifyEmailGate('https://abc.trycloudflare.com',{fetchImpl:async()=>{calls++;return new Response('<div id="root">private-data</div>');},pauseImpl:async()=>{},log:v=>logs.push(v)}),/reached the application/);
 assert.equal(calls,1);assert.ok(logs.every(v=>!v.includes('private-data')));
});
test('unrecognized external response remains blocked after bounded retries',async()=>{
 let calls=0;
 await assert.rejects(verifyEmailGate('https://abc.trycloudflare.com',{fetchImpl:async()=>{calls++;return new Response('unknown',{status:200});},pauseImpl:async()=>{},attempts:2,log:()=>{}}),/after retries/);
 assert.equal(calls,2);
});
