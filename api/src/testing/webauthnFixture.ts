import crypto from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import type { AuthenticationResponseJSON,RegistrationResponseJSON } from '@simplewebauthn/server';
// Software authenticator for adversarial protocol fixtures; production never imports this module.
export function authenticator() {
  const pair=crypto.generateKeyPairSync('ec',{namedCurve:'prime256v1'});
  const jwk=pair.publicKey.export({format:'jwk'});
  const id=crypto.randomBytes(32);
  const key=isoCBOR.encode(new Map<number,number|Uint8Array>([[1,2],[3,-7],[-1,1],[-2,new Uint8Array(Buffer.from(jwk.x!,'base64url'))],[-3,new Uint8Array(Buffer.from(jwk.y!,'base64url'))]]));
  const rpHash=(rp:string)=>crypto.createHash('sha256').update(rp).digest();
  function client(challenge:string,origin:string,type:string) {return Buffer.from(JSON.stringify({type,challenge,origin,crossOrigin:false}));}
  return {
    id:id.toString('base64url'),
    registration(challenge:string,origin='http://localhost:3000',rp='localhost',uv=true):RegistrationResponseJSON {
      const length=Buffer.alloc(2);length.writeUInt16BE(id.length);
      const data=Buffer.concat([rpHash(rp),Buffer.from([uv?0x45:0x41]),Buffer.alloc(4),Buffer.alloc(16),length,id,Buffer.from(key)]);
      return {id:id.toString('base64url'),rawId:id.toString('base64url'),type:'public-key',clientExtensionResults:{},response:{clientDataJSON:client(challenge,origin,'webauthn.create').toString('base64url'),attestationObject:Buffer.from(isoCBOR.encode(new Map<string,string|Map<never,never>|Uint8Array>([['fmt','none'],['attStmt',new Map<never,never>()],['authData',new Uint8Array(data)]]))).toString('base64url')}};
    },
    authentication(challenge:string,counter=1,origin='http://localhost:3000',rp='localhost',uv=true):AuthenticationResponseJSON {
      const count=Buffer.alloc(4);count.writeUInt32BE(counter);
      const data=Buffer.concat([rpHash(rp),Buffer.from([uv?5:1]),count]);
      const json=client(challenge,origin,'webauthn.get');
      const signature=crypto.sign('sha256',Buffer.concat([data,crypto.createHash('sha256').update(json).digest()]),pair.privateKey);
      return {id:id.toString('base64url'),rawId:id.toString('base64url'),type:'public-key',clientExtensionResults:{},response:{clientDataJSON:json.toString('base64url'),authenticatorData:data.toString('base64url'),signature:signature.toString('base64url')}};
    },
  };
}
