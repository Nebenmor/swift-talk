# 💬 Real-Time Chat App

A modern, full-stack real-time chat application built with React, Node.js, TypeScript, Socket.IO, and MongoDB.

![Chat App Demo](https://via.placeholder.com/800x400/3b82f6/ffffff?text=ChatApp+Demo)

## 🌟 Features

### ✨ **Core Functionality**
- 🔐 **User Authentication** - JWT-based login/register system
- 👥 **Friend Management** - Send/accept friend requests, user search
- 💬 **Real-time Messaging** - Instant messaging with Socket.IO
- 📁 **File Sharing** - Upload and share files with drag & drop
- 📱 **Responsive Design** - Mobile-first, works on all devices
- ⚡ **Live Updates** - Typing indicators, online status, read receipts

### 🔒 **Security Features**
- Password strength validation
- JWT token authentication
- Rate limiting protection
- File upload security
- Input validation & sanitization
- CORS protection

### 🎨 **User Experience**
- Modern, clean UI with Tailwind CSS
- Dark/light theme ready
- Smooth animations & transitions
- Optimistic UI updates
- Error handling & loading states
- Offline support

## 🛠 Tech Stack

### **Frontend**
- **React 18** - Modern React with hooks
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool and dev server
- **Tailwind CSS 4.1** - Utility-first CSS framework
- **Zustand** - Lightweight state management
- **Socket.IO Client** - Real-time communication
- **React Hook Form** - Form handling with validation
- **React Router** - Client-side routing

### **Backend**
- **Node.js** - JavaScript runtime
- **Express** - Web application framework
- **TypeScript** - Type-safe server development
- **Socket.IO** - Real-time bidirectional communication
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - JSON Web Tokens for authentication
- **Multer** - File upload handling
- **bcrypt** - Password hashing

## 🚀 Quick Start

### Prerequisites
- Node.js 16.x or higher
- MongoDB (local or MongoDB Atlas)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd chatApp
   ```

2. **Install root dependencies**
   ```bash
   npm install
   ```

3. **Setup Backend**
   ```bash
   cd server
   npm install
   
   # Copy environment file
   cp .env.example .env
   # Edit .env with your configurations
   
   # Setup database
   npm run setup-db
   ```

4. **Setup Frontend**
   ```bash
   cd ../client
   npm install
   
   # Copy environment file
   cp .env.example .env
   # Edit .env with your configurations
   ```

5. **Start Development**
   ```bash
   # From root directory - starts both frontend and backend
   npm run dev
   
   # Or start separately:
   # Backend: cd server && npm run dev
   # Frontend: cd client && npm run dev
   ```

6. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000/api
   - Health Check: http://localhost:5000/health

## 📁 Project Structure

```
chatApp/
├── README.md                    # This file
├── package.json                 # Root dependencies
├── .gitignore                   # Git ignore rules
│
├── server/                      # Backend application
│   ├── src/
│   │   ├── controllers/         # Route controllers
│   │   ├── services/            # Business logic
│   │   ├── models/              # Database models
│   │   ├── routes/              # API routes
│   │   ├── middleware/          # Express middleware
│   │   ├── socket/              # Socket.IO handlers
│   │   ├── config/              # Configuration files
│   │   ├── utils/               # Utility functions
│   │   └── types/               # TypeScript types
│   ├── uploads/                 # File upload directory
│   ├── scripts/                 # Database scripts
│   └── package.json             # Backend dependencies
│
└── client/                      # Frontend application
    ├── src/
    │   ├── components/          # React components
    │   ├── pages/               # Page components
    │   ├── stores/              # Zustand stores
    │   ├── services/            # API services
    │   ├── hooks/               # Custom hooks
    │   ├── types/               # TypeScript types
    │   └── utils/               # Utility functions
    ├── public/                  # Static assets
    └── package.json             # Frontend dependencies
```

## 🔧 Configuration

### Backend Environment Variables (.env)
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/chatapp
DB_NAME=chatapp
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:3000
MAX_FILE_SIZE=5242880
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,application/pdf,text/plain
```

### Frontend Environment Variables (.env)
```env
VITE_API_BASE_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
VITE_APP_NAME=ChatApp
```

## 📚 API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### User Endpoints
- `GET /api/users/search` - Search users
- `GET /api/users/friends/list` - Get friends list
- `POST /api/users/friends/request` - Send friend request
- `PUT /api/users/friends/requests/:id/accept` - Accept friend request
- `PUT /api/users/friends/requests/:id/decline` - Decline friend request

### Chat Endpoints
- `POST /api/chat/messages` - Send message
- `POST /api/chat/messages/file` - Send file message
- `GET /api/chat/history/:userId` - Get chat history
- `PUT /api/chat/messages/:userId/read` - Mark messages as read

### Socket.IO Events

#### Client → Server
- `authenticate` - Authenticate user
- `send_message` - Send real-time message
- `typing_start` - Start typing indicator
- `typing_stop` - Stop typing indicator
- `join_chat` - Join chat room
- `leave_chat` - Leave chat room

#### Server → Client
- `authenticated` - Authentication success
- `new_message` - New message received
- `user_typing` - User typing status
- `friend_status_update` - Friend online/offline
- `message_notification` - Message notification

## 🧪 Testing

### Backend Testing
```bash
cd server
npm run test              # Run tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage
```

### Frontend Testing
```bash
cd client
npm run test              # Run tests
npm run test:watch        # Run tests in watch mode
npm run test:coverage     # Run tests with coverage
```

## 🏗 Build & Deployment

### Development Build
```bash
npm run dev               # Start development servers
```

### Production Build
```bash
npm run build            # Build both frontend and backend
cd client && npm run build    # Build frontend only
cd server && npm run build    # Build backend only
```

### Production Start
```bash
npm start                # Start production server
```

## 📱 Mobile App (Future)

The application is designed to be easily extended to mobile platforms:
- React Native implementation ready
- Shared TypeScript types
- API-first architecture
- Real-time Socket.IO support

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript strict mode
- Use ESLint and Prettier for code formatting
- Write tests for new features
- Update documentation for API changes
- Follow conventional commits

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **React Team** - For the amazing React framework
- **Vercel** - For the incredible Vite build tool
- **MongoDB** - For the flexible database solution
- **Socket.IO** - For real-time communication
- **Tailwind CSS** - For the utility-first CSS framework

## 📞 Support

For support, email support@chatapp.com or join our Slack channel.

## 🔗 Links

- [Live Demo](https://your-demo-url.com)
- [API Documentation](https://your-api-docs.com)
- [Frontend Storybook](https://your-storybook.com)
- [Backend Swagger](https://your-swagger.com)

---

<div align="center">
  <strong>Built with ❤️ using modern web technologies</strong>
</div>