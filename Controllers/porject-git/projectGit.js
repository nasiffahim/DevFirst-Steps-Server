import axios from "axios";

const BASE_URL = "https://api.github.com/search/repositories";

export const project_get = async (req, res) => {
  const { names } = req.params;

  if (!names) {
    return res.status(400).json({ error: "Invalid repository name" });
  }

  try {
    const headers = {
      Accept: "application/vnd.github.v3+json",
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`, // single Authorization header
    };

    const response = await axios.get(
      `${BASE_URL}?q=${encodeURIComponent(names)}&sort=stars&order=desc&per_page=10`,
      { headers }
    );

    res.json(response.data.items || []);
  } catch (err) {
    console.error(err.response?.data || err.message);
    res
      .status(err.response?.status || 500)
      .json({ error: "Failed to fetch from GitHub" });
  }
};
