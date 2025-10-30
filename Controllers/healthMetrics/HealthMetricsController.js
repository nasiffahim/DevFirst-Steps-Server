import axios from "axios";

// Helper function to calculate days between dates
const daysBetween = (date1, date2) => {
  const diffTime = Math.abs(new Date(date2) - new Date(date1));
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Helper function to calculate hours between dates
const hoursBetween = (date1, date2) => {
  const diffTime = Math.abs(new Date(date2) - new Date(date1));
  return Math.round(diffTime / (1000 * 60 * 60));
};

// Calculate average issue response time
const calculateIssueResponseTime = async (owner, repo, token) => {
  try {
    const { data: issues } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        params: {
          state: "all",
          per_page: 30,
          sort: "created",
          direction: "desc",
        },
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    let totalResponseTime = 0;
    let issuesWithResponse = 0;

    for (const issue of issues) {
      if (issue.pull_request) continue; // Skip PRs

      if (issue.comments > 0) {
        try {
          const { data: comments } = await axios.get(issue.comments_url, {
            headers: {
              Accept: "application/vnd.github.v3+json",
              Authorization: `Bearer ${token}`,
            },
          });

          if (comments.length > 0) {
            const firstComment = comments[0];
            const responseTime = hoursBetween(
              issue.created_at,
              firstComment.created_at
            );
            totalResponseTime += responseTime;
            issuesWithResponse++;
          }
        } catch (err) {
          console.error("Error fetching comments:", err.message);
        }
      }
    }

    const avgResponseTime =
      issuesWithResponse > 0
        ? Math.round(totalResponseTime / issuesWithResponse)
        : 0;

    // Score calculation (lower is better)
    // < 24h = 100, 24-48h = 80, 48-72h = 60, 72-168h = 40, > 168h = 20
    let score = 100;
    if (avgResponseTime > 168) score = 20;
    else if (avgResponseTime > 72) score = 40;
    else if (avgResponseTime > 48) score = 60;
    else if (avgResponseTime > 24) score = 80;

    return { avgResponseTime, score, issuesAnalyzed: issuesWithResponse };
  } catch (err) {
    console.error("Error calculating issue response time:", err.message);
    return { avgResponseTime: 0, score: 0, issuesAnalyzed: 0 };
  }
};

// Calculate average PR merge time
const calculatePRMergeTime = async (owner, repo, token) => {
  try {
    const { data: pulls } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        params: {
          state: "closed",
          per_page: 30,
          sort: "updated",
          direction: "desc",
        },
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    let totalMergeTime = 0;
    let mergedPRs = 0;

    for (const pr of pulls) {
      if (pr.merged_at) {
        const mergeTime = hoursBetween(pr.created_at, pr.merged_at);
        totalMergeTime += mergeTime;
        mergedPRs++;
      }
    }

    const avgMergeTime =
      mergedPRs > 0 ? Math.round(totalMergeTime / mergedPRs) : 0;

    // Score calculation (lower is better)
    // < 48h = 100, 48-96h = 80, 96-168h = 60, 168-336h = 40, > 336h = 20
    let score = 100;
    if (avgMergeTime > 336) score = 20;
    else if (avgMergeTime > 168) score = 40;
    else if (avgMergeTime > 96) score = 60;
    else if (avgMergeTime > 48) score = 80;

    return { avgMergeTime, score, prsAnalyzed: mergedPRs };
  } catch (err) {
    console.error("Error calculating PR merge time:", err.message);
    return { avgMergeTime: 0, score: 0, prsAnalyzed: 0 };
  }
};

// Calculate star/fork growth trends
const calculateGrowthTrends = async (owner, repo, token) => {
  try {
    const { data: repo_data } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}`,
      {
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Get recent commits to estimate activity
    const { data: commits } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
      {
        params: {
          per_page: 100,
          since: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const repoAge = daysBetween(repo_data.created_at, new Date());
    const monthlyStarRate =
      repoAge > 0 ? (repo_data.stargazers_count / repoAge) * 30 : 0;
    const monthlyForkRate =
      repoAge > 0 ? (repo_data.forks_count / repoAge) * 30 : 0;

    // Estimate growth based on commit activity
    const commitsLast30Days = commits.length;

    // Score based on growth indicators
    let score = 0;
    if (monthlyStarRate > 100) score += 40;
    else if (monthlyStarRate > 50) score += 30;
    else if (monthlyStarRate > 10) score += 20;
    else if (monthlyStarRate > 1) score += 10;

    if (monthlyForkRate > 20) score += 30;
    else if (monthlyForkRate > 10) score += 20;
    else if (monthlyForkRate > 5) score += 15;
    else if (monthlyForkRate > 1) score += 10;

    if (commitsLast30Days > 50) score += 30;
    else if (commitsLast30Days > 20) score += 20;
    else if (commitsLast30Days > 10) score += 15;
    else if (commitsLast30Days > 5) score += 10;

    return {
      starGrowth30d: Math.round(monthlyStarRate),
      forkGrowth30d: Math.round(monthlyForkRate),
      commitsLast30Days,
      score: Math.min(score, 100),
    };
  } catch (err) {
    console.error("Error calculating growth trends:", err.message);
    return {
      starGrowth30d: 0,
      forkGrowth30d: 0,
      commitsLast30Days: 0,
      score: 0,
    };
  }
};

// Calculate contributor retention and churn
const calculateContributorMetrics = async (owner, repo, token) => {
  try {
    const { data: contributors } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contributors`,
      {
        params: { per_page: 100 },
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    // Get recent commits to check active contributors
    const { data: recentCommits } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
      {
        params: {
          per_page: 100,
          since: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        },
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const activeContributors = new Set(
      recentCommits.map((commit) => commit.author?.login).filter(Boolean)
    );

    const totalContributors = contributors.length;
    const activeCount = activeContributors.size;
    const retentionRate =
      totalContributors > 0
        ? Math.round((activeCount / Math.min(totalContributors, 20)) * 100)
        : 0;

    // Identify active maintainers (top 5 contributors with recent activity)
    const activeMaintainers = contributors
      .slice(0, 10)
      .filter((c) => activeContributors.has(c.login)).length;

    // Score based on retention and active maintainers
    let retentionScore = 0;
    if (retentionRate > 70) retentionScore = 100;
    else if (retentionRate > 50) retentionScore = 80;
    else if (retentionRate > 30) retentionScore = 60;
    else if (retentionRate > 15) retentionScore = 40;
    else retentionScore = 20;

    let maintainerScore = 0;
    if (activeMaintainers >= 5) maintainerScore = 100;
    else if (activeMaintainers >= 3) maintainerScore = 80;
    else if (activeMaintainers >= 2) maintainerScore = 60;
    else if (activeMaintainers >= 1) maintainerScore = 40;
    else maintainerScore = 20;

    return {
      totalContributors,
      activeContributors: activeCount,
      activeMaintainers,
      contributorRetention: retentionRate,
      retentionScore,
      maintainerScore,
    };
  } catch (err) {
    console.error("Error calculating contributor metrics:", err.message);
    return {
      totalContributors: 0,
      activeContributors: 0,
      activeMaintainers: 0,
      contributorRetention: 0,
      retentionScore: 0,
      maintainerScore: 0,
    };
  }
};

// Calculate update frequency
const calculateUpdateFrequency = async (owner, repo, token) => {
  try {
    const { data: commits } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
      {
        params: {
          per_page: 100,
          since: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        },
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const commitsLast90Days = commits.length;
    const avgCommitsPerWeek = Math.round((commitsLast90Days / 90) * 7);

    // Score based on update frequency
    let score = 0;
    if (avgCommitsPerWeek > 10) score = 100;
    else if (avgCommitsPerWeek > 5) score = 80;
    else if (avgCommitsPerWeek > 2) score = 60;
    else if (avgCommitsPerWeek > 0) score = 40;
    else score = 20;

    return {
      commitsLast90Days,
      avgCommitsPerWeek,
      score,
    };
  } catch (err) {
    console.error("Error calculating update frequency:", err.message);
    return {
      commitsLast90Days: 0,
      avgCommitsPerWeek: 0,
      score: 0,
    };
  }
};

// Main controller function
export const getRepositoryHealth = async (req, res) => {
  try {
    const { owner, repo } = req.params;
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo) {
      return res
        .status(400)
        .json({ error: "Owner and repo parameters required" });
    }

    console.log(`Calculating health metrics for ${owner}/${repo}...`);

    // Calculate all metrics in parallel for better performance
    const [
      issueResponse,
      prMerge,
      growth,
      contributors,
      updateFreq,
    ] = await Promise.all([
      calculateIssueResponseTime(owner, repo, token),
      calculatePRMergeTime(owner, repo, token),
      calculateGrowthTrends(owner, repo, token),
      calculateContributorMetrics(owner, repo, token),
      calculateUpdateFrequency(owner, repo, token),
    ]);

    // Calculate overall health score (weighted average)
    const overallHealth = Math.round(
      issueResponse.score * 0.2 +
        prMerge.score * 0.2 +
        growth.score * 0.2 +
        contributors.retentionScore * 0.15 +
        contributors.maintainerScore * 0.15 +
        updateFreq.score * 0.1
    );

    // Determine health level
    let healthLevel = "🔴 Dormant";
    let recommendation =
      "This repository shows low activity. Consider checking if it's actively maintained before contributing.";

    if (overallHealth >= 80) {
      healthLevel = "🟢 Healthy";
      recommendation =
        "This is an actively maintained repository with good community engagement. Great choice for contributions!";
    } else if (overallHealth >= 60) {
      healthLevel = "🟡 Moderate";
      recommendation =
        "This repository is moderately active. Check recent issues and PRs to gauge current maintainer responsiveness.";
    } else if (overallHealth >= 40) {
      healthLevel = "🟠 Low Activity";
      recommendation =
        "This repository shows signs of low activity. Your contributions might take longer to be reviewed.";
    }

    const healthData = {
      owner,
      repo,
      overallHealth,
      healthLevel,
      recommendation,
      metrics: {
        avgIssueResponseTime: issueResponse.avgResponseTime,
        avgPRMergeTime: prMerge.avgMergeTime,
        starGrowth30d: growth.starGrowth30d,
        forkGrowth30d: growth.forkGrowth30d,
        commitsLast30Days: growth.commitsLast30Days,
        activeMaintainers: contributors.activeMaintainers,
        contributorRetention: contributors.contributorRetention,
        totalContributors: contributors.totalContributors,
        avgCommitsPerWeek: updateFreq.avgCommitsPerWeek,
      },
      breakdown: {
        responseTimeScore: issueResponse.score,
        mergeSpeedScore: prMerge.score,
        growthScore: growth.score,
        retentionScore: contributors.retentionScore,
        maintainerScore: contributors.maintainerScore,
        updateFrequencyScore: updateFreq.score,
      },
      dataPoints: {
        issuesAnalyzed: issueResponse.issuesAnalyzed,
        prsAnalyzed: prMerge.prsAnalyzed,
        contributorsAnalyzed: contributors.totalContributors,
      },
    };

    res.json(healthData);
  } catch (err) {
    console.error("Error calculating repository health:", err.message);
    res.status(500).json({
      error: "Failed to calculate repository health",
      message: err.message,
    });
  }
};