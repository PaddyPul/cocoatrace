require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const app = require('./app');

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`\n🫘 CocoaTrace API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
});
