import axios from "axios";

// 🔍 Search GitHub repo
async function searchGitHubRepo(projectName) {
  try {
    const response = await axios.get(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(
        projectName
      )}+in:name&sort=stars&order=desc&per_page=1`,
      {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`, // Add your token
        },
      }
    );

    const repo = response.data.items?.[0];
    return repo
      ? {
          url: repo.html_url,
          stars: repo.stargazers_count,
          language: repo.language,
        }
      : {
          url: `https://github.com/search?q=${encodeURIComponent(projectName)}`,
          stars: 0,
          language: "Unknown",
        };
  } catch (err) {
    console.error("❌ GitHub search error:", err.message);
    return { url: "https://github.com", stars: 0, language: "Error" };
  }
}

// 💡 AI Project Suggestion Controller
export const aiSuggestion = async (req, res) => {
  const { skills } = req.body;

  if (!skills || skills.trim() === "") {
    return res.status(400).json({ error: "Please provide skills" });
  }

  try {
    // Step 1: Generate project ideas with OpenAI
    const aiResponse = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: `
Suggest 3 open-source project ideas for these skills: ${skills}.
Return ONLY raw JSON:
[
  { "name": "Project Name", "description": "Short description" }
]
            `,
          },
        ],
        max_tokens: 300,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    let content = aiResponse.data?.choices?.[0]?.message?.content?.trim();
    if (content.startsWith("```")) {
      content = content.replace(/```json|```/g, "").trim();
    }

    let ideas;
    try {
      ideas = JSON.parse(content);
    } catch {
      return res
        .status(500)
        .json({ error: "AI response parsing failed", raw: content });
    }

    // Step 2: Fetch GitHub repo info
    const projects = await Promise.all(
      ideas.map(async (idea) => {
        const repo = await searchGitHubRepo(idea.name);
        return { ...idea, ...repo };
      })
    );

    res.json({ projects });
  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
    res.status(500).json({ error: "Failed to fetch project suggestions" });
  }
};
