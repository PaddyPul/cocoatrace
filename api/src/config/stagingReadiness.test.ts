import {describe,expect,it} from 'vitest';
import {parseConfig} from './env';
import {stagingReadinessFailures} from './stagingReadiness';
const base={APP_ENV:'staging',DATABASE_URL:'postgresql://fixture:fixture@database.internal/cocoatrace_staging',DATABASE_SSL:'true',DATABASE_SSL_REJECT_UNAUTHORIZED:'true',JWT_SECRET:'separate-staging-session-secret-123456789',WEB_URL:'https://staging.cocoatrace.example',PUBLIC_WEB_URL:'https://staging.cocoatrace.example',COOKIE_SECURE:'true',APP_VERSION:'a675c965',EVIDENCE_STORAGE_DRIVER:'s3',EVIDENCE_STORAGE_ENDPOINT:'https://objects.example.com',EVIDENCE_STORAGE_BUCKET:'cocoatrace-staging-evidence',EVIDENCE_STORAGE_ACCESS_KEY:'fixture',EVIDENCE_STORAGE_SECRET_KEY:'fixture',EVIDENCE_STORAGE_SSE:'AES256',EVIDENCE_STORAGE_AUTO_CREATE_BUCKET:'false',EVIDENCE_UPLOAD_SIGNING_SECRET:'separate-staging-upload-secret-123456789',EVIDENCE_SCANNER_DRIVER:'clamav',EVIDENCE_SCANNER_HOST:'scanner.internal',IDENTITY_EMAIL_ENABLED:'true',EMAIL_DRIVER:'smtp',EMAIL_FROM:'noreply@cocoatrace.example',SMTP_HOST:'smtp.example.com',SMTP_USER:'fixture',SMTP_PASSWORD:'fixture',SMTP_REQUIRE_TLS:'true',SMTP_TLS_REJECT_UNAUTHORIZED:'true'};
describe('staging release preflight',()=>{
 it('accepts a provisioned, separated staging configuration',()=>expect(stagingReadinessFailures(parseConfig(base))).toEqual([]));
 it('rejects email-disabled registration even when generic runtime config permits it',()=>expect(stagingReadinessFailures(parseConfig({...base,IDENTITY_EMAIL_ENABLED:'false'})).join()).toContain('SMTP'));
 it('rejects disabled or weakened database TLS',()=>{
  expect(stagingReadinessFailures(parseConfig({...base,DATABASE_SSL:'false'})).join()).toContain('TLS');
  expect(stagingReadinessFailures(parseConfig({...base,DATABASE_URL:base.DATABASE_URL+'?sslmode=disable'})).join()).toContain('TLS');
 });
 it('rejects template signing secrets without exposing their values',()=>expect(stagingReadinessFailures(parseConfig({...base,JWT_SECRET:'REPLACE_WITH_UNIQUE_SESSION_SECRET'})).join()).toContain('template'));
 it('rejects shared session/upload secrets',()=>expect(stagingReadinessFailures(parseConfig({...base,EVIDENCE_UPLOAD_SIGNING_SECRET:base.JWT_SECRET})).join()).toContain('different'));
 it('rejects automatic storage provisioning and a mutable release identifier',()=>{
  const failures=stagingReadinessFailures(parseConfig({...base,EVIDENCE_STORAGE_AUTO_CREATE_BUCKET:'true',APP_VERSION:'latest'}));
  expect(failures).toHaveLength(2);
 });
});
