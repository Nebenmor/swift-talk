const { MongoClient } = require('mongodb');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatapp';
const DB_NAME = process.env.DB_NAME || 'chatapp';

async function setupDatabase() {
  let client;
  
  try {
    console.log('🔄 Connecting to MongoDB...');
    client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db(DB_NAME);
    console.log(`✅ Connected to database: ${DB_NAME}`);

    // Create collections
    console.log('🔄 Setting up collections...');
    
    // Users collection
    const usersCollection = db.collection('users');
    await usersCollection.createIndexes([
      { key: { username: 1 }, unique: true },
      { key: { email: 1 }, unique: true },
      { key: { isOnline: 1 } },
      { key: { lastSeen: -1 } }
    ]);
    console.log('✅ Users collection and indexes created');

    // Messages collection
    const messagesCollection = db.collection('messages');
    await messagesCollection.createIndexes([
      { key: { sender: 1, recipient: 1 } },
      { key: { recipient: 1, isRead: 1 } },
      { key: { createdAt: -1 } },
      { key: { sender: 1, recipient: 1, createdAt: -1 } }
    ]);
    console.log('✅ Messages collection and indexes created');

    // Friendships collection
    const friendshipsCollection = db.collection('friendships');
    await friendshipsCollection.createIndexes([
      { key: { requester: 1, recipient: 1 }, unique: true },
      { key: { recipient: 1, status: 1 } },
      { key: { requester: 1, status: 1 } }
    ]);
    console.log('✅ Friendships collection and indexes created');

    // Create test data (optional)
    if (process.argv.includes('--with-test-data')) {
      await createTestData(db);
    }

    console.log('🎉 Database setup completed successfully!');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('👋 Database connection closed');
    }
  }
}

async function createTestData(db) {
  console.log('🔄 Creating test data...');
  
  const bcrypt = require('bcryptjs');
  
  // Test users
  const testUsers = [
    {
      username: 'testuser1',
      email: 'test1@example.com',
      password: await bcrypt.hash('Password123', 12),
      isOnline: false,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    },
    {
      username: 'testuser2',
      email: 'test2@example.com',
      password: await bcrypt.hash('Password123', 12),
      isOnline: false,
      lastSeen: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    }
  ];

  try {
    await db.collection('users').insertMany(testUsers);
    console.log('✅ Test users created');
  } catch (error) {
    if (error.code === 11000) {
      console.log('ℹ️ Test users already exist');
    } else {
      throw error;
    }
  }
}

// Run the setup
if (require.main === module) {
  setupDatabase();
}

module.exports = { setupDatabase };