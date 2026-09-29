const TEST_DATABASE_PATTERN = /(?:^|[_-])test(?:$|[_-])/i;

export function requireDisposableTestDatabase(rawUrl?: string): string {
  if (!rawUrl) {
    throw new Error(
      'QLT-001 requires TEST_DATABASE_URL (or DATABASE_URL) pointing to a disposable PostgreSQL test database.',
    );
  }

  let databaseUrl: URL;
  try {
    databaseUrl = new URL(rawUrl);
  } catch {
    throw new Error('The PostgreSQL integration-test database URL is invalid.');
  }

  if (!['postgres:', 'postgresql:'].includes(databaseUrl.protocol)) {
    throw new Error('Integration tests require a PostgreSQL database URL.');
  }

  const databaseName = decodeURIComponent(databaseUrl.pathname.replace(/^\//, ''));
  if (!TEST_DATABASE_PATTERN.test(databaseName)) {
    throw new Error(
      `Refusing to reset database "${databaseName}". Its name must contain a standalone "test" segment.`,
    );
  }

  return rawUrl;
}

