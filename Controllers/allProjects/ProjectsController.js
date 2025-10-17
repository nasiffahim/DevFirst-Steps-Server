import axios from "axios";

// ✅ Get all open-source projects
export const getAllProjects = async (req, res) => {
  try {
    const {
      query = "",
      lang = "",
      topics = "",
      stars = "100",
      forks = "10",
      sort = "stars",
      order = "desc",
      page = "1",
      perPage = "9",
    } = req.query;

    let searchQuery = "";

    if (query) searchQuery += `${query} `;
    if (lang) searchQuery += `${lang} `;

    if (topics) {
      const topicList = topics.split(",");
      searchQuery += topicList.map((t) => t.trim()).join(" ") + " ";
    }

    searchQuery += `stars:>${stars} forks:>${forks}`;

    const githubUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(
      searchQuery.trim()
    )}&sort=${sort}&order=${order}&page=${page}&per_page=${perPage}`;

    const { data } = await axios.get(githubUrl, {
      timeout: 10000,
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    });

    res.json(data);
  } catch (err) {
    console.error("Error fetching projects:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Get project details by ID
export const getProjectById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("Fetching project details for ID:", id);
    const githubUrl = `https://api.github.com/repositories/${id}`;
    const { data } = await axios.get(githubUrl, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    });

    res.json(data);
  } catch (err) {
    console.error("Error fetching project details:", err.message);

    try {
      // Fallback: search by repo name
      const searchUrl = `https://api.github.com/search/repositories?q=repo:${req.params.id}`;
      const { data } = await axios.get(searchUrl, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        },
      });

      if (data.items && data.items.length > 0) {
        res.json(data.items[0]);
      } else {
        res.status(404).json({ error: "Project not found" });
      }
    } catch (searchErr) {
      console.error("Search fallback also failed:", searchErr.message);
      res.status(500).json({ error: "Failed to fetch project details" });
    }
  }
};

// ✅ Skill matcher
export const getSkillMatchedProjects = async (req, res) => {
  try {
    const { skills, minStars = "500", minForks = "50", perSkill = "3" } = req.query;

    if (!skills) {
      return res.status(400).json({ error: "skills query required" });
    }

    const skillList = skills.split(",").map((s) => s.trim());
    const languageKeywords = [
      "javascript", "python", "java", "typescript", "swift", "kotlin",
      "c#", "c++", "html", "css", "objective-c", "sql", "go", "rust",
      "ruby", "php",
    ];

    const projectPromises = skillList.map(async (skill) => {
      const skillLower = skill.toLowerCase();
      let searchQuery = "";

      if (languageKeywords.includes(skillLower)) {
        const capitalizedSkill = skill.charAt(0).toUpperCase() + skill.slice(1);
        searchQuery = `language:${capitalizedSkill} stars:>${minStars} forks:>${minForks}`;
      } else {
        searchQuery = `${skill} stars:>${minStars} forks:>${minForks}`;
      }

      const githubUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(
        searchQuery
      )}&sort=stars&order=desc&page=1&per_page=${perSkill}`;

      try {
        const { data } = await axios.get(githubUrl, {
          timeout: 10000,
          headers: {
            Accept: "application/vnd.github.v3+json",
            Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
          },
        });

        return {
          skill,
          projects: data.items || [],
          count: data.items?.length || 0,
        };
      } catch (error) {
        console.error(`Error fetching projects for ${skill}:`, error.message);
        return { skill, projects: [], count: 0 };
      }
    });

    const skillResults = await Promise.all(projectPromises);

    const allProjects = [];
    const seenIds = new Set();

    skillResults.forEach((result) => {
      result.projects.forEach((project) => {
        if (!seenIds.has(project.id)) {
          seenIds.add(project.id);
          allProjects.push({ ...project, matched_skill: result.skill });
        }
      });
    });

    const sortedProjects = allProjects
      .sort((a, b) => b.stargazers_count - a.stargazers_count)
      .slice(0, 10);

    res.json({
      projects: sortedProjects,
      total_count: sortedProjects.length,
      matched_skills: skillList,
      skill_breakdown: skillResults.map((r) => ({
        skill: r.skill,
        count: r.count,
      })),
    });
  } catch (err) {
    console.error("Error fetching skill-matched projects:", err.message);
    res.status(500).json({ error: "Failed to fetch projects" });
  }
};
