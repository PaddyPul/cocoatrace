import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../.env') });

import app from './app';
import logger from './logger';

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  logger.info({ port: PORT }, `CocoaTrace API running on http://localhost:${PORT}`);
});
