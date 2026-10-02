import test from 'node:test';
import assert from 'node:assert/strict';
import {validateEmails,parseTunnelUrl,validateState,isEmailGate} from './demo-preview.mjs';
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
