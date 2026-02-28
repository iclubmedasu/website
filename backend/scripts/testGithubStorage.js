require('dotenv').config();
const { uploadFile, deleteFile } = require('../services/githubStorageService');

async function main() {
  console.log('Testing GitHub storage service...');
  
  const testBuffer = Buffer.from('Hello from iClub portal - GitHub storage test');
  
  console.log('Uploading test file...');
  const result = await uploadFile(testBuffer, 'test-file.txt', 'text/plain', 0);
  console.log('Upload success:', result);
  
  console.log('Deleting test file...');
  await deleteFile(result.githubPath, result.githubSha);
  console.log('Delete success ✓');
  
  console.log('\nAll tests passed. GitHub storage is working.');
}

main().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
