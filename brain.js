const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const DATA_FILE = path.join(__dirname, "conversations.json");

// --------------------------
// File helpers
// --------------------------
function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { users: {} };
    }

    const raw = fs.readFileSync(DATA_FILE, "utf8");

    if (!raw.trim()) {
      return { users: {} };
    }

    return JSON.parse(raw);
  } catch (error) {
    console.error("Error loading conversations.json:", error);
    return { users: {} };
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
  } catch (error) {
    console.error("Error saving conversations.json:", error);
  }
}

let db = loadData();

// --------------------------
// Utility helpers
// --------------------------
function createId(prefix = "") {
  return prefix + Date.now() + "-" + Math.random().toString(36).slice(2, 10);
}

function ensureUser(userId) {
  if (!userId) return null;

  if (!db.users[userId]) {
    const firstChatId = createId("chat-");
    db.users[userId] = {
      currentChatId: firstChatId,
      chats: [
        {
          id: firstChatId,
          title: "New Chat",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          messages: []
        }
      ]
    };
    saveData(db);
  }

  return db.users[userId];
}

function getChat(user, chatId) {
  return user.chats.find((chat) => chat.id === chatId);
}

function generateReply(message, messages) {
  const text = String(message || "").trim();
  const lower = text.toLowerCase();

  if (lower === "hello" || lower === "hi") {
    return "Hello! I am your AI.";
  }

  if (lower.includes("how are you")) {
    return "I am doing well. I am ready to help.";
  }

  if (lower.includes("what is your name") || lower.includes("who are you")) {
    return "My name is Shaun AI.";
  }

  if (lower.includes("what did i say")) {
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length >= 2) {
      return `You previously said: "${userMessages[userMessages.length - 2].content}"`;
    }
    return "This is the first thing you have said in this conversation.";
  }

  return `You said: ${text}`;
}

function makeTitle(firstMessage) {
  const clean = String(firstMessage || "").trim();
  if (!clean) return "New Chat";
  return clean.length > 30 ? clean.slice(0, 30) + "..." : clean;
}

// --------------------------
// Routes
// --------------------------

// Serve frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Get or create current user + chats
app.get("/conversations", (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const user = ensureUser(userId);

  const chatList = user.chats
    .map((chat) => ({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

  res.json({
    currentChatId: user.currentChatId,
    chats: chatList
  });
});

// Create new chat
app.post("/conversations", (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const user = ensureUser(userId);

  const newChat = {
    id: createId("chat-"),
    title: "New Chat",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };

  user.chats.unshift(newChat);
  user.currentChatId = newChat.id;

  saveData(db);

  res.json({
    message: "New chat created",
    chat: newChat,
    currentChatId: user.currentChatId
  });
});

// Get one chat
app.get("/conversations/:chatId", (req, res) => {
  const userId = req.query.userId;
  const { chatId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const user = ensureUser(userId);
  const chat = getChat(user, chatId);

  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }

  user.currentChatId = chatId;
  saveData(db);

  res.json(chat);
});

// Delete one chat
app.delete("/conversations/:chatId", (req, res) => {
  const userId = req.query.userId;
  const { chatId } = req.params;

  if (!userId) {
    return res.status(400).json({ error: "userId is required" });
  }

  const user = ensureUser(userId);

  const index = user.chats.findIndex((chat) => chat.id === chatId);
  if (index === -1) {
    return res.status(404).json({ error: "Chat not found" });
  }

  user.chats.splice(index, 1);

  if (user.chats.length === 0) {
    const replacementChat = {
      id: createId("chat-"),
      title: "New Chat",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
    user.chats.push(replacementChat);
    user.currentChatId = replacementChat.id;
  } else if (user.currentChatId === chatId) {
    user.currentChatId = user.chats[0].id;
  }

  saveData(db);

  res.json({
    message: "Chat deleted",
    currentChatId: user.currentChatId,
    chats: user.chats.map((chat) => ({
      id: chat.id,
      title: chat.title,
      createdAt: chat.createdAt,
      updatedAt: chat.updatedAt
    }))
  });
});

// Ask AI in a specific chat
app.post("/ask", (req, res) => {
  const { userId, chatId, message } = req.body;

  if (!userId || !chatId || !message) {
    return res.status(400).json({
      error: "userId, chatId, and message are required"
    });
  }

  const user = ensureUser(userId);
  const chat = getChat(user, chatId);

  if (!chat) {
    return res.status(404).json({ error: "Chat not found" });
  }

  const userMessage = {
    role: "user",
    content: message
  };

  chat.messages.push(userMessage);

  const replyText = generateReply(message, chat.messages);

  const assistantMessage = {
    role: "assistant",
    content: replyText
  };

  chat.messages.push(assistantMessage);

  if (chat.messages.length === 2 && chat.title === "New Chat") {
    chat.title = makeTitle(message);
  }

  chat.updatedAt = new Date().toISOString();
  user.currentChatId = chat.id;

  saveData(db);

  res.json({
    reply: replyText,
    chat
  });
});

// Optional old compatibility route
app.get("/memory", (req, res) => {
  const userId = req.query.userId;
  if (!userId) {
    return res.json([]);
  }

  const user = ensureUser(userId);
  const currentChat = getChat(user, user.currentChatId);

  res.json(currentChat ? currentChat.messages : []);
});

app.listen(PORT, () => {
  console.log(`AI running on http://localhost:${PORT}`);
});