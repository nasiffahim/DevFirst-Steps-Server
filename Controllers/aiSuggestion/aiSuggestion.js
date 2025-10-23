import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function searchGitHubRepo(projectName, techStack) {
  try {
    const searchQuery = `${projectName} ${techStack}`;
    
    const response = await axios.get(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(
        searchQuery
      )}&sort=stars&order=desc&per_page=1`,
      {
        headers: { 
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json'
        },
      }
    );
    
    const repo = response.data.items?.[0];
    
    if (repo) {
      // Fetch additional repo details
      const detailsResponse = await axios.get(
        `https://api.github.com/repos/${repo.full_name}`,
        {
          headers: { 
            Authorization: `token ${process.env.GITHUB_TOKEN}`,
            Accept: 'application/vnd.github.v3+json'
          },
        }
      );

      const details = detailsResponse.data;

      return {
        url: details.html_url,
        stars: details.stargazers_count,
        forks: details.forks_count,
        watchers: details.watchers_count,
        openIssues: details.open_issues_count,
        language: details.language || "Multiple",
        license: details.license?.name || "Not specified",
        lastUpdated: details.updated_at,
        topics: details.topics || [],
        contributorsCount: null, // Will be set below if available
        actualName: details.name
      };
    }
    
    return {
      url: `https://github.com/search?q=${encodeURIComponent(projectName)}`,
      stars: 0,
      forks: 0,
      watchers: 0,
      openIssues: 0,
      language: "Unknown",
      license: "Unknown",
      lastUpdated: null,
      topics: [],
      contributorsCount: null,
      actualName: projectName
    };
  } catch (err) {
    console.error("GitHub search error:", err.message);
    return {
      url: `https://github.com/search?q=${encodeURIComponent(projectName)}`,
      stars: 0,
      forks: 0,
      watchers: 0,
      openIssues: 0,
      language: "Error",
      license: "Unknown",
      lastUpdated: null,
      topics: [],
      contributorsCount: null,
      actualName: projectName
    };
  }
}

export const aiSuggestion = async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  const { interests, skillLevel, techStack, count = 5 } = req.body;
  
  if (!techStack) {
    res.write(`data: ${JSON.stringify({ error: "Please provide tech stack" })}\n\n`);
    return res.end();
  }

  const projectCount = Math.min(Math.max(parseInt(count) || 5, 1), 10);

  const prompt = `You are an expert at recommending open-source projects on GitHub.

Based on the following information, suggest ${projectCount} real, existing open-source projects that would be good for someone to contribute to or learn from:
- Tech Stack/Skills: ${techStack}
- Skill Level: ${skillLevel || "intermediate"}
- Interests: ${interests || "general development"}

Requirements:
1. Suggest REAL projects that exist on GitHub (popular, well-maintained projects)
2. Projects should match the tech stack as closely as possible
3. Consider the skill level - beginner projects should be simpler, advanced can be more complex
4. Include a mix of different types of projects (libraries, frameworks, applications, tools)
5. Provide variety - don't suggest similar projects

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
[
  {
    "name": "Project Name",
    "description": "A brief description of what this project does and why it's good to contribute to (2-3 sentences)",
    "techStack": ["React", "Node.js", "MongoDB"]
  }
]`;

  try {
    res.write(`data: ${JSON.stringify({ status: "Analyzing your skills..." })}\n\n`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an AI that recommends real, existing open-source projects. Always return valid JSON arrays."
        },
        { role: "user", content: prompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    let content = completion.choices?.[0]?.message?.content?.trim();
    
    if (content.startsWith("```json")) {
      content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    } else if (content.startsWith("```")) {
      content = content.replace(/```\n?/g, "").trim();
    }

    res.write(`data: ${JSON.stringify({ status: "Parsing AI suggestions..." })}\n\n`);

    let ideas;
    try {
      ideas = JSON.parse(content);
    } catch (parseError) {
      console.error("Parse error:", parseError);
      console.error("Content:", content);
      res.write(`data: ${JSON.stringify({ error: "Failed to parse AI response" })}\n\n`);
      return res.end();
    }

    // Search GitHub for each project
    for (let i = 0; i < ideas.length; i++) {
      const idea = ideas[i];
      
      res.write(`data: ${JSON.stringify({ 
        status: `Finding GitHub repo ${i + 1}/${ideas.length}: ${idea.name}...` 
      })}\n\n`);

      const repo = await searchGitHubRepo(idea.name, techStack);
      
      const projectData = {
        name: idea.name,
        description: idea.description,
        techStack: idea.techStack || [],
        url: repo.url,
        stars: repo.stars,
        forks: repo.forks,
        watchers: repo.watchers,
        openIssues: repo.openIssues,
        language: repo.language,
        license: repo.license,
        lastUpdated: repo.lastUpdated,
        topics: repo.topics,
        contributorsCount: repo.contributorsCount,
      };

      res.write(`data: ${JSON.stringify({ content: projectData })}\n\n`);
      
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    
  } catch (err) {
    console.error("Error:", err.message);
    res.write(`data: ${JSON.stringify({ 
      error: "Failed to generate suggestions. Please try again." 
    })}\n\n`);
    res.end();
  }
};