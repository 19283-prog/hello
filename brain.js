const express = require("express");
const cors = require("cors");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const MEMORY_FILE = "memory.json";

app.use(cors());
app.use(express.json());

let memory = [];

if (fs.existsSync(MEMORY_FILE)) {
  try {
    const data = fs.readFileSync(MEMORY_FILE, "utf8");
    memory = JSON.parse(data);
  } catch (error) {
    console.log("Could not load memory.json");
    memory = [];
  }
}

function saveMemory() {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

async function getAIResponse(question) {
  const lower = question.toLowerCase().trim();

  if (lower === "hello" || lower === "hi") {
    return "Hello! I am your AI.";
  }

  if (lower.includes("how are you")) {
    return "I am doing well. I am ready to help.";
  }

  if (lower.includes("your name")) {
    return "My name is Shaun AI.";
  }

  return "You said: " + question;
}

app.get("/", (req, res) => {
  res.send("Shaun AI backend is running.");
});

app.get("/memory", (req, res) => {
  res.json(memory);
});

app.post("/ask", async (req, res) => {
  const question = req.body.question;

  if (!question) {
    return res.status(400).json({ answer: "No question provided." });
  }

  const answer = await getAIResponse(question);

  memory.push({ role: "user", content: question });
  memory.push({ role: "assistant", content: answer });

  saveMemory();

  res.json({ answer });
});

app.listen(PORT, () => {
  console.log(`AI running on port ${PORT}`);
});