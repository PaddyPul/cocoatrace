import {describe,expect,it} from 'vitest';
import {assertPreviewTarget} from './demoPreviewGuard';
const url='postgresql://preview:secret@postgres:5432/cocoatrace_demo_preview';
describe('synthetic preview target guard',()=>{
 it('allows only the explicitly marked dedicated preview',()=>expect(()=>assertPreviewTarget(url,'demo',true,'true')).not.toThrow());
 it.each([
  [url,'production',true,'true'],[url,'staging',true,'true'],[url,'demo',false,'true'],[url,'demo',true,undefined],
  [url.replace('/cocoatrace_demo_preview','/cocoatrace'),'demo',true,'true'],
  [url.replace('@postgres','@remote.example'),'demo',true,'true'],
  [url.replace('preview:','customer:'),'demo',true,'true'],
 ] as const)('rejects unsafe target/mode %s %s',(target,env,demo,enabled)=>expect(()=>assertPreviewTarget(target,env,demo,enabled)).toThrow());
});
