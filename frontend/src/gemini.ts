import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Google Generative AI with the API key
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("VITE_GEMINI_API_KEY is missing! Make sure it is set in your .env file.");
} else {
  console.log("Gemini API Key loaded successfully (length: " + API_KEY.length + ")");
}

const genAI = new GoogleGenerativeAI(API_KEY || "DUMMY_KEY");

// Get the model - using the stable flash model
export const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
