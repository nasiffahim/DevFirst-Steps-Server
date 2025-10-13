import axios from "axios";

// ✅ Get beginner-friendly open-source projects
export const getBeginnerProjects = async (req, res) => {
  try {
    const {
      query = "",
      lang = "",
      sort = "stars",
      order = "desc",
      page = "1",
      perPage = "10",
      minStars = "50",
      minIssues = "3",
    } = req.query;

    let searchQuery = "";

    // Add custom search query if provided
    if (query) {
      searchQuery += `${query} `;
    }

    // Add language filter
    if (lang && lang !== "All") {
      searchQuery += `language:${lang} `;
    }

    // Core beginner-friendly filters
    searchQuery += `good-first-issues:>${minIssues} `;
    searchQuery += `stars:>${minStars} `;
    searchQuery += `is:public `;

    // Additional helpful filters for beginners
    searchQuery += `archived:false `; // Exclude archived repos
    
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

    // Enrich response with beginner-friendly metadata
    const enrichedItems = data.items?.map((project) => ({
      ...project,
      beginner_friendly: true,
      good_first_issues_count: project.open_issues_count, // Approximation
      contribution_guide_url: `${project.html_url}/blob/main/CONTRIBUTING.md`,
    }));

    res.json({
      ...data,
      items: enrichedItems,
    });
  } catch (err) {
    console.error("Error fetching beginner projects:", err.message);
    
    if (err.response?.status === 403) {
      return res.status(403).json({ 
        error: "GitHub API rate limit exceeded. Please try again later." 
      });
    }
    
    if (err.response?.status === 422) {
      return res.status(422).json({ 
        error: "Invalid search query. Please adjust your filters." 
      });
    }
    
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Get beginner projects with multiple difficulty labels
export const getBeginnerProjectsByLabel = async (req, res) => {
  try {
    const {
      lang = "",
      sort = "stars",
      order = "desc",
      page = "1",
      perPage = "10",
      minStars = "50",
      label = "good-first-issue", // good-first-issue, beginner-friendly, first-timers-only
    } = req.query;

    let searchQuery = "";

    // Add language filter
    if (lang && lang !== "All") {
      searchQuery += `language:${lang} `;
    }

    // Search by specific label
    searchQuery += `label:"${label}" `;
    searchQuery += `stars:>${minStars} `;
    searchQuery += `is:public archived:false `;

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
    console.error("Error fetching projects by label:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Get beginner projects with active maintainers (recent updates)
export const getActiveBeginnerProjects = async (req, res) => {
  try {
    const {
      lang = "",
      page = "1",
      perPage = "10",
      minStars = "100",
      daysAgo = "30", // Only show projects updated in last X days
    } = req.query;

    const date = new Date();
    date.setDate(date.getDate() - parseInt(daysAgo));
    const dateString = date.toISOString().split("T")[0];

    let searchQuery = "";

    if (lang && lang !== "All") {
      searchQuery += `language:${lang} `;
    }

    searchQuery += `good-first-issues:>3 `;
    searchQuery += `stars:>${minStars} `;
    searchQuery += `pushed:>${dateString} `; // Recently updated
    searchQuery += `is:public archived:false `;

    const githubUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(
      searchQuery.trim()
    )}&sort=updated&order=desc&page=${page}&per_page=${perPage}`;

    const { data } = await axios.get(githubUrl, {
      timeout: 10000,
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    });

    res.json(data);
  } catch (err) {
    console.error("Error fetching active beginner projects:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Get beginner issues from a specific repository
export const getBeginnerIssues = async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const { page = "1", perPage = "10", state = "open" } = req.query;

    // Search for beginner-friendly issues
    const labels = ["good first issue", "beginner-friendly", "first-timers-only"];
    const labelQuery = labels.map((l) => `label:"${l}"`).join(" ");

    const githubUrl = `https://api.github.com/search/issues?q=repo:${owner}/${repo} ${labelQuery} is:issue state:${state}&sort=created&order=desc&page=${page}&per_page=${perPage}`;

    const { data } = await axios.get(githubUrl, {
      timeout: 10000,
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    });

    res.json(data);
  } catch (err) {
    console.error("Error fetching beginner issues:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};

// ✅ Get trending beginner projects (last 7 days)
export const getTrendingBeginnerProjects = async (req, res) => {
  try {
    const {
      lang = "",
      page = "1",
      perPage = "10",
      minStars = "50",
    } = req.query;

    const date = new Date();
    date.setDate(date.getDate() - 7);
    const dateString = date.toISOString().split("T")[0];

    let searchQuery = "";

    if (lang && lang !== "All") {
      searchQuery += `language:${lang} `;
    }

    searchQuery += `good-first-issues:>3 `;
    searchQuery += `stars:>${minStars} `;
    searchQuery += `created:>${dateString} `; // Created in last 7 days
    searchQuery += `is:public archived:false `;

    const githubUrl = `https://api.github.com/search/repositories?q=${encodeURIComponent(
      searchQuery.trim()
    )}&sort=stars&order=desc&page=${page}&per_page=${perPage}`;

    const { data } = await axios.get(githubUrl, {
      timeout: 10000,
      headers: {
        Accept: "application/vnd.github.v3+json",
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      },
    });

    res.json(data);
  } catch (err) {
    console.error("Error fetching trending beginner projects:", err.message);
    res.status(500).json({ error: "Server error" });
  }
};