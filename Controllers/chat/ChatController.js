import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Support route
export const Support = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    // 🔹 Step 1: Get AI reply
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "We're Dev First Steps a open source platform. We're six members in our team we do basically solve boring exploring open source project. From now anyone can search/explore it's own favorite open source project in this platform. We're based on Bangladesh and We're Abu Hasan, Nasif, Aziz, Sohel, Raihan Uddin, and Naimul Hasan" },
        { role: "user", content: message },
      ],
    });

    const aiReply = response.choices[0].message.content;

    // 🔹 Step 2: Store in MongoDB

    // 🔹 Step 3: Send reply to frontend
    res.json({ reply: aiReply });
  } catch (error) {
    console.error("❌ OpenAI Error:", error);

    if (error.status === 429 || error.code === "insufficient_quota") {
      return res.status(429).json({
        error: "🚫 OpenAI quota exceeded. Please check your billing plan.",
      });
    }

    res.status(500).json({ error: "Something went wrong with OpenAI API." });
  }
};
