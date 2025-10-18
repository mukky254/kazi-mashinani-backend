const mongoose = require('mongoose');

const MONGODB_URI = 'mongodb+srv://kaziuser:securepassword123@cluster0.bneqb6q.mongodb.net/kaziDB?retryWrites=true&w=majority';

console.log('🔐 Testing MongoDB connection...');
console.log('URI:', MONGODB_URI);

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverSelectionTimeoutMS: 5000,
})
.then(() => {
  console.log('✅ SUCCESS: Connected to MongoDB!');
  console.log('Database:', mongoose.connection.db.databaseName);
  process.exit(0);
})
.catch(error => {
  console.error('❌ FAILED: MongoDB connection error:');
  console.error('Error name:', error.name);
  console.error('Error message:', error.message);
  console.error('Error code:', error.code);
  
  if (error.message.includes('authentication failed')) {
    console.log('\n💡 SOLUTION: Check your username and password in MongoDB Atlas');
  } else if (error.message.includes('getaddrinfo')) {
    console.log('\n💡 SOLUTION: Check your cluster URL and network access');
  }
  
  process.exit(1);
});
