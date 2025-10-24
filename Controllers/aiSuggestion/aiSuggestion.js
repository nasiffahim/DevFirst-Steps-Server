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
        contributorsCount: null,
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

  const { interests, skillLevel, techStack } = req.body;
  
  if (!techStack) {
    res.write(`data: ${JSON.stringify({ error: "Please provide tech stack" })}\n\n`);
    return res.end();
  }

  try {
    // PHASE 1: Generate Custom Project Ideas
    res.write(`data: ${JSON.stringify({ status: "Creating custom project ideas for you..." })}\n\n`);

    const customIdeasPrompt = `You are an expert at suggesting project ideas for developers to build and practice their skills.

Based on the following information, suggest 4-5 unique project ideas that someone can build from scratch:
- Tech Stack/Skills: ${techStack}
- Skill Level: ${skillLevel || "intermediate"}
- Interests: ${interests || "general development"}

Requirements:
1. Suggest PRACTICAL projects that can be built with the given tech stack
2. Match the complexity to the skill level (beginner = simpler, advanced = more complex)
3. Include variety - web apps, tools, games, APIs, etc.
4. Each project should be engaging and educational
5. Include 3-4 key features for each project

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
[
  {
    "name": "Project Name",
    "description": "A detailed description of what this project does and why it's valuable to build (2-3 sentences)",
    "features": ["Feature 1", "Feature 2", "Feature 3"],
    "techStack": ["React", "Node.js"],
    "difficulty": "Beginner/Intermediate/Advanced"
  }
]`;

    const customIdeasCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an AI that suggests creative, practical project ideas for developers. Always return valid JSON arrays."
        },
        { role: "user", content: customIdeasPrompt },
      ],
      max_tokens: 1200,
      temperature: 0.8,
    });

    let customContent = customIdeasCompletion.choices?.[0]?.message?.content?.trim();
    
    if (customContent.startsWith("```json")) {
      customContent = customContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    } else if (customContent.startsWith("```")) {
      customContent = customContent.replace(/```\n?/g, "").trim();
    }

    let customIdeas;
    try {
      customIdeas = JSON.parse(customContent);
    } catch (parseError) {
      console.error("Parse error for custom ideas:", parseError);
      res.write(`data: ${JSON.stringify({ error: "Failed to parse custom project ideas" })}\n\n`);
      return res.end();
    }

    // Stream custom ideas to frontend
    for (const idea of customIdeas) {
      res.write(`data: ${JSON.stringify({ customIdea: idea })}\n\n`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // PHASE 2: Generate GitHub Project Recommendations
    res.write(`data: ${JSON.stringify({ status: "Finding open-source projects on GitHub..." })}\n\n`);

    const githubPrompt = `You are an expert at recommending open-source projects on GitHub.

Based on the following information, suggest 4-5 real, existing, POPULAR open-source projects that would be good to explore or contribute to:
- Tech Stack/Skills: ${techStack}
- Skill Level: ${skillLevel || "intermediate"}
- Interests: ${interests || "general development"}

Requirements:
1. Suggest REAL, POPULAR projects that exist on GitHub (well-known, well-maintained)
2. Projects should closely match the tech stack
3. Consider the skill level when suggesting projects
4. Include a mix of different types (libraries, frameworks, applications, tools)
5. These should be projects people can learn from or contribute to

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
[
  {
    "name": "Project Name (exact GitHub repo name)",
    "description": "A brief description of what this project does and why it's good to explore or contribute to (2-3 sentences)",
    "techStack": ["React", "Node.js"]
  }
]`;

    const githubCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an AI that recommends real, existing, popular open-source projects. Always return valid JSON arrays."
        },
        { role: "user", content: githubPrompt },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    let githubContent = githubCompletion.choices?.[0]?.message?.content?.trim();
    
    if (githubContent.startsWith("```json")) {
      githubContent = githubContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    } else if (githubContent.startsWith("```")) {
      githubContent = githubContent.replace(/```\n?/g, "").trim();
    }

    let githubIdeas;
    try {
      githubIdeas = JSON.parse(githubContent);
    } catch (parseError) {
      console.error("Parse error for GitHub projects:", parseError);
      res.write(`data: ${JSON.stringify({ error: "Failed to parse GitHub recommendations" })}\n\n`);
      return res.end();
    }

    // Search GitHub for each project and stream results
    for (let i = 0; i < githubIdeas.length; i++) {
      const idea = githubIdeas[i];
      
      res.write(`data: ${JSON.stringify({ 
        status: `Finding GitHub repo ${i + 1}/${githubIdeas.length}: ${idea.name}...` 
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

      res.write(`data: ${JSON.stringify({ githubProject: projectData })}\n\n`);
      
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