import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function searchGitHubRepo(projectName) {
  try {
    const response = await axios.get(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(
        projectName
      )}+in:name,description&sort=stars&order=desc&per_page=1`,
      {
        headers: { Authorization: `token ${process.env.GITHUB_TOKEN}` },
      }
    );
    const repo = response.data.items?.[0];
    return repo
      ? { url: repo.html_url, stars: repo.stargazers_count, language: repo.language }
      : { url: `https://github.com/search?q=${encodeURIComponent(projectName)}`, stars: 0, language: "Unknown" };
  } catch (err) {
    console.error("GitHub search error:", err.message);
    return { url: "https://github.com", stars: 0, language: "Error" };
  }
}

export const aiSuggestion = async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const { interests, skillLevel, techStack } = req.body;
  if (!interests && !skillLevel && !techStack) {
    res.write(`data: ${JSON.stringify({ error: "Please provide preferences" })}\n\n`);
    return res.end();
  }

  const prompt = `
    Suggest 3 open-source project ideas.
    - Interests: ${interests || "unspecified"}
    - Skill Level: ${skillLevel || "any"}
    - Tech Stack: ${techStack || "unspecified"}
    Return only JSON:
    [
      { "name": "Project Name", "description": "Short summary", "techStack": ["React", "Node.js"] }
    ]
  `;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are an AI that suggests project ideas." },
        { role: "user", content: prompt },
      ],
      max_tokens: 400,
    });

    let content = completion.choices?.[0]?.message?.content?.trim();
    if (content.startsWith("```")) content = content.replace(/```json|```/g, "").trim();
    const ideas = JSON.parse(content);

    for (let i = 0; i < ideas.length; i++) {
      const idea = ideas[i];
      res.write(`data: ${JSON.stringify({ status: `Searching GitHub for idea ${i + 1}` })}\n\n`);
      const repo = await searchGitHubRepo(idea.name);
      res.write(`data: ${JSON.stringify({ content: { ...idea, ...repo } })}\n\n`);
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err) {
    console.error("Error:", err.message);
    res.write(`data: ${JSON.stringify({ error: "Failed to generate suggestions" })}\n\n`);
    res.end();
  }
};
