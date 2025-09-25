# SwiftTalk

A modern, real-time chat application built with React, TypeScript, Node.js, Express, Socket.IO, and MongoDB. SwiftTalk provides instant messaging, file sharing, friend management, and real-time notifications with a sleek, responsive user interface.

## Features

- **Real-time Messaging**: Instant message delivery using Socket.IO
- **File Sharing**: Upload and share images, documents, and PDFs with preview functionality
- **Friend System**: Send/receive friend requests, manage friendships
- **Read Receipts**: Real-time message read status updates
- **Online Status**: See when friends are online/offline
- **Responsive Design**: Mobile-friendly interface with modern UI/UX
- **File Preview**: Preview files before sending them
- **Push Notifications**: Browser notifications for new messages
- **Typing Indicators**: See when friends are typing
- **Message History**: Persistent chat history with pagination

## Tech Stack

### Frontend
- **React 19** with TypeScript
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Socket.IO Client** for real-time communication
- **Axios** for HTTP requests
- **React Hot Toast** for notifications

### Backend
- **Node.js** with TypeScript
- **Express.js** web framework
- **Socket.IO** for real-time communication
- **MongoDB** with Mongoose ODM
- **JWT** for authentication
- **Multer** for file uploads
- **bcryptjs** for password hashing

## Project Structure

```
chatApp/
├── client/                          # Frontend React application
│   ├── public/
│   │   ├── index.html
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/              # React components
│   │   │   ├── AddFriend.tsx        # Add friend modal
│   │   │   ├── Chat.tsx             # Main chat interface
│   │   │   ├── FriendRequests.tsx   # Friend requests management
│   │   │   ├── FriendsList.tsx      # Friends sidebar list
│   │   │   ├── Login.tsx            # Login form
│   │   │   ├── MessageInput.tsx     # Message input with file preview
│   │   │   ├── MessageList.tsx      # Message display area
│   │   │   └── Signup.tsx           # Registration form
│   │   ├── lib/                     # Utility libraries
│   │   │   ├── api.ts               # Axios HTTP client
│   │   │   ├── auth.ts              # Authentication utilities
│   │   │   ├── NotificationService.ts # Browser notifications
│   │   │   └── socket.ts            # Socket.IO client setup
│   │   ├── types.ts                 # TypeScript type definitions
│   │   ├── App.tsx                  # Main app component
│   │   ├── index.css                # Global styles
│   │   ├── main.tsx                 # React entry point
│   │   └── vite-env.d.ts           # Vite type definitions
│   ├── .env                         # Frontend environment variables
│   ├── eslint.config.js            # ESLint configuration
│   ├── index.html                   # HTML template
│   ├── package.json                 # Frontend dependencies
│   ├── postcss.config.js           # PostCSS configuration
│   ├── tailwind.config.js          # Tailwind CSS configuration
│   ├── tsconfig.json               # TypeScript configuration
│   ├── tsconfig.node.json          # TypeScript Node configuration
│   └── vite.config.ts              # Vite build configuration
├── server/                          # Backend Node.js application
│   ├── src/
│   │   ├── config/                  # Configuration files
│   │   │   ├── config.ts            # Application configuration
│   │   │   └── database.ts          # MongoDB connection setup
│   │   ├── controllers/             # Route controllers
│   │   │   ├── authController.ts    # Authentication endpoints
│   │   │   ├── chatController.ts    # Chat/messaging endpoints
│   │   │   └── userController.ts    # User management endpoints
│   │   ├── middleware/              # Express middleware
│   │   │   ├── auth.ts              # JWT authentication middleware
│   │   │   ├── upload.ts            # File upload middleware
│   │   │   └── validation.ts        # Request validation middleware
│   │   ├── models/                  # MongoDB schemas
│   │   │   ├── Friendship.ts        # Friend relationship model
│   │   │   ├── Message.ts           # Chat message model
│   │   │   └── User.ts              # User account model
│   │   ├── routes/                  # API route definitions
│   │   │   ├── authRoutes.ts        # Authentication routes
│   │   │   ├── chatRoutes.ts        # Chat/messaging routes
│   │   │   └── userRoutes.ts        # User management routes
│   │   ├── services/                # Business logic layer
│   │   │   ├── authService.ts       # Authentication logic
│   │   │   ├── chatService.ts       # Chat/messaging logic
│   │   │   └── userService.ts       # User management logic
│   │   ├── socket/                  # Socket.IO handlers
│   │   │   └── socketHandlers.ts    # Real-time event handlers
│   │   ├── utils/                   # Utility functions
│   │   │   ├── jwt.ts               # JWT token utilities
│   │   │   ├── password.ts          # Password hashing utilities
│   │   │   └── response.ts          # API response utilities
│   │   ├── types/                   # TypeScript definitions
│   │   │   └── index.ts             # Shared type definitions
│   │   ├── app.ts                   # Express app configuration
│   │   └── server.ts                # Server entry point
│   ├── uploads/                     # File upload storage
│   ├── .env                         # Backend environment variables
│   ├── package.json                 # Backend dependencies
│   ├── setup-database.js           # Database initialization script
│   └── tsconfig.json               # TypeScript configuration
└── README.md                        # This file
```

## Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (v5.0 or higher)
- npm or yarn

### Backend Setup

1. Navigate to the server directory:
```bash
cd server
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file in the server directory:
```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/<database>
DB_NAME=chatapp

# JWT
JWT_SECRET=your-super-secure-jwt-secret-key
JWT_EXPIRES_IN=7d

# File Upload
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf,text/plain

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CLIENT_URL=http://localhost:3000
```

4. Set up the database (optional - creates indexes and test data):
```bash
node setup-database.js --with-test-data
```

5. Start the development server:
```bash
npm run dev
```

The server will start on `http://localhost:5000`

### Frontend Setup

1. Navigate to the client directory:
```bash
cd client
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file in the client directory:
```env
VITE_API_BASE_URL=http://localhost:5000
VITE_SOCKET_URL=http://localhost:5000
```

4. Start the development server:
```bash
npm run dev
```

The client will start on `http://localhost:3000`

## API Endpoints

### Authentication Routes (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - User login
- `POST /logout` - User logout
- `GET /me` - Get current user
- `PUT /profile` - Update user profile
- `PUT /change-password` - Change password
- `POST /refresh-token` - Refresh JWT token
- `GET /verify` - Verify JWT token

### User Management Routes (`/api/users`)
- `GET /search` - Search users
- `GET /:userId` - Get user by ID
- `GET /username/:username` - Get user by username
- `GET /friends/list` - Get friends list
- `GET /friends/with-messages` - Get friends with last messages
- `GET /friends/online` - Get online friends
- `POST /friends/request` - Send friend request
- `GET /friends/requests/pending` - Get pending requests
- `GET /friends/requests/sent` - Get sent requests
- `PUT /friends/requests/:requestId/accept` - Accept friend request
- `PUT /friends/requests/:requestId/decline` - Decline friend request
- `DELETE /friends/:friendId` - Remove friend
- `POST /:userId/block` - Block user
- `GET /:userId/friendship-status` - Get friendship status
- `GET /stats` - Get user statistics
- `PUT /online-status` - Update online status

### Chat Routes (`/api/chat`)
- `POST /messages` - Send text message
- `POST /messages/file` - Send file message
- `GET /history/:userId` - Get chat history
- `PUT /messages/:userId/read` - Mark messages as read
- `GET /unread-count` - Get unread count
- `DELETE /messages/:messageId` - Delete message
- `GET /messages/search` - Search messages
- `GET /rooms` - Get chat rooms
- `GET /messages/:messageId` - Get message by ID
- `POST /upload` - Upload file
- `GET /users/:userId/online` - Get user online status

## Socket.IO Events

### Client to Server Events
- `authenticate` - Authenticate socket connection
- `send_message` - Send a message
- `mark_messages_read` - Mark messages as read
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `update_online_status` - Update online status

### Server to Client Events
- `authenticated` - Authentication successful
- `auth_error` - Authentication failed
- `new_message` - New message received
- `messages_read` - Messages marked as read
- `message_sent` - Message sent confirmation
- `message_error` - Message sending failed
- `friend_status_update` - Friend online status changed
- `user_typing` - User typing indicator

## Development Scripts

### Backend (`server/`)
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

### Frontend (`client/`)
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Features Deep Dive

### Real-time Messaging
SwiftTalk uses Socket.IO for instant message delivery. Messages are sent via WebSocket when possible, falling back to HTTP polling if needed. The app handles connection failures gracefully and queues messages when offline.

### File Sharing
Users can upload and share various file types:
- Images (JPEG, PNG, GIF, WebP) with inline preview
- Documents (PDF, DOC, DOCX, TXT)
- Maximum file size: 10MB
- Files are stored on the server with secure access controls

### Friend System
- Send friend requests by username
- Accept/decline incoming requests
- View sent requests with cancel option
- Remove friends
- Block/unblock users

### Security Features
- JWT-based authentication
- Password hashing with bcrypt
- Rate limiting on all endpoints
- File upload validation
- XSS protection with Helmet.js
- CORS configuration

### Performance Optimizations
- Message pagination for chat history
- Debounced friend search
- Optimistic UI updates
- Memoized React components
- Efficient database queries with indexes

## Browser Support
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Built with React and Express
- Real-time communication powered by Socket.IO
- Database management with MongoDB and Mongoose
- UI styling with Tailwind CSS
- File handling with Multer

---

**SwiftTalk** - Connect instantly, chat effortlessly.