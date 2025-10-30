import axios from "axios";

// Helper to batch API calls
const batchRequests = async (requests, batchSize = 10) => {
  const results = [];
  for (let i = 0; i < requests.length; i += batchSize) {
    const batch = requests.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch);
    results.push(...batchResults);
  }
  return results;
};

const calculatePRQuality = async (owner, repo, username, token) => {
  try {
    const { data: allPRs } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        params: {
          state: "all",
          per_page: 50, // Reduced from 100
          creator: username,
        },
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    let totalPRs = allPRs.length;
    let mergedPRs = 0;
    let closedUnmergedPRs = 0;
    let openPRs = 0;
    let totalAdditions = 0;
    let totalDeletions = 0;
    let totalReviewComments = 0;
    let complexityScore = 0;

    // Count basic stats from PR list (no extra API calls needed)
    allPRs.forEach(pr => {
      if (pr.merged_at) mergedPRs++;
      else if (pr.state === "closed") closedUnmergedPRs++;
      else openPRs++;
    });

    // Only fetch details for recent PRs (limit to 20 most recent)
    const recentPRs = allPRs.slice(0, 20);
    
    // Create batched requests for PR details
    const prDetailsRequests = recentPRs.map(pr =>
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}`, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
        timeout: 5000,
      }).catch(err => {
        console.error(`Error fetching PR #${pr.number}: ${err.message}`);
        return null;
      })
    );

    // Execute in parallel batches of 10
    const prDetailsResults = await batchRequests(prDetailsRequests, 10);

    // Process results
    let validPRCount = 0;
    for (const result of prDetailsResults) {
      if (result.status === 'fulfilled' && result.value?.data) {
        const prDetails = result.value.data;
        validPRCount++;
        
        totalAdditions += prDetails.additions || 0;
        totalDeletions += prDetails.deletions || 0;

        const changes = (prDetails.additions || 0) + (prDetails.deletions || 0);
        if (changes < 50) complexityScore += 10;
        else if (changes < 200) complexityScore += 8;
        else if (changes < 500) complexityScore += 5;
        else complexityScore += 3;
      }
    }

    // Fetch reviews for recent PRs in parallel
    const reviewRequests = recentPRs.map(pr =>
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
        timeout: 5000,
      }).catch(err => {
        console.error(`Error fetching reviews for PR #${pr.number}: ${err.message}`);
        return null;
      })
    );

    const reviewResults = await batchRequests(reviewRequests, 10);
    
    for (const result of reviewResults) {
      if (result.status === 'fulfilled' && result.value?.data) {
        totalReviewComments += result.value.data.length;
      }
    }

    const mergeRate = totalPRs > 0 ? (mergedPRs / totalPRs) * 100 : 0;
    const avgComplexity = validPRCount > 0 ? complexityScore / validPRCount : 0;

    // Score calculation
    let score = 0;
    
    if (mergeRate >= 80) score += 40;
    else if (mergeRate >= 60) score += 30;
    else if (mergeRate >= 40) score += 20;
    else if (mergeRate >= 20) score += 10;

    score += Math.min(avgComplexity * 3, 30);

    const avgReviews = validPRCount > 0 ? totalReviewComments / validPRCount : 0;
    if (avgReviews >= 5) score += 30;
    else if (avgReviews >= 3) score += 20;
    else if (avgReviews >= 1) score += 10;

    return {
      totalPRs,
      mergedPRs,
      closedUnmergedPRs,
      openPRs,
      mergeRate: Math.round(mergeRate),
      totalAdditions,
      totalDeletions,
      avgReviewsPerPR: Math.round(avgReviews * 10) / 10,
      complexityScore: Math.round(avgComplexity),
      score: Math.min(Math.round(score), 100),
    };
  } catch (err) {
    console.error("Error calculating PR quality:", err.message);
    return {
      totalPRs: 0,
      mergedPRs: 0,
      closedUnmergedPRs: 0,
      openPRs: 0,
      mergeRate: 0,
      totalAdditions: 0,
      totalDeletions: 0,
      avgReviewsPerPR: 0,
      complexityScore: 0,
      score: 0,
    };
  }
};

const calculateIssueMetrics = async (owner, repo, username, token) => {
  try {
    const { data: openedIssues } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        params: {
          state: "all",
          creator: username,
          per_page: 50, // Reduced from 100
        },
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const issuesOpened = openedIssues.filter(issue => !issue.pull_request).length;
    const issuesClosed = openedIssues.filter(
      issue => !issue.pull_request && issue.state === "closed"
    ).length;

    // Only check recent 20 closed issues for resolution
    const { data: allClosedIssues } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/issues`,
      {
        params: {
          state: "closed",
          per_page: 20, // Reduced from 100
        },
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const issueEventRequests = allClosedIssues
      .filter(issue => !issue.pull_request)
      .slice(0, 15) // Only check 15 issues
      .map(issue =>
        axios.get(issue.events_url, {
          headers: {
            Accept: "application/vnd.github.v3+json",
            Authorization: `Bearer ${token}`,
          },
          timeout: 5000,
        }).catch(err => {
          console.error(`Error fetching issue events: ${err.message}`);
          return null;
        })
      );

    const eventResults = await batchRequests(issueEventRequests, 10);

    let issuesResolved = 0;
    for (const result of eventResults) {
      if (result.status === 'fulfilled' && result.value?.data) {
        const events = result.value.data;
        const closedByUser = events.some(
          event => event.event === "closed" && event.actor?.login === username
        );
        if (closedByUser) issuesResolved++;
      }
    }

    const resolutionRate = issuesOpened > 0 ? (issuesClosed / issuesOpened) * 100 : 0;

    let score = 0;
    if (resolutionRate >= 80) score += 50;
    else if (resolutionRate >= 60) score += 40;
    else if (resolutionRate >= 40) score += 30;
    else if (resolutionRate >= 20) score += 20;

    if (issuesResolved >= 10) score += 30;
    else if (issuesResolved >= 5) score += 20;
    else if (issuesResolved >= 2) score += 10;

    if (issuesResolved > issuesOpened) score += 20;
    else if (issuesResolved === issuesOpened && issuesResolved > 0) score += 15;
    else if (issuesResolved > 0) score += 10;

    return {
      issuesOpened,
      issuesClosed,
      issuesResolved,
      resolutionRate: Math.round(resolutionRate),
      score: Math.min(Math.round(score), 100),
    };
  } catch (err) {
    console.error("Error calculating issue metrics:", err.message);
    return {
      issuesOpened: 0,
      issuesClosed: 0,
      issuesResolved: 0,
      resolutionRate: 0,
      score: 0,
    };
  }
};

const calculateReviewParticipation = async (owner, repo, username, token) => {
  try {
    const { data: allPRs } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/pulls`,
      {
        params: {
          state: "all",
          per_page: 50, // Reduced
        },
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    let reviewsGiven = 0;
    let approvalsGiven = 0;
    let changesRequested = 0;
    let commentsGiven = 0;

    // Only check recent 20 PRs
    const prsToCheck = allPRs.slice(0, 20);
    
    const reviewRequests = prsToCheck.map(pr =>
      axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
        timeout: 5000,
      }).catch(err => {
        console.error(`Error fetching reviews for PR #${pr.number}: ${err.message}`);
        return null;
      })
    );

    const reviewResults = await batchRequests(reviewRequests, 10);

    for (const result of reviewResults) {
      if (result.status === 'fulfilled' && result.value?.data) {
        const reviews = result.value.data;
        const userReviews = reviews.filter(review => review.user?.login === username);
        reviewsGiven += userReviews.length;

        for (const review of userReviews) {
          if (review.state === "APPROVED") approvalsGiven++;
          if (review.state === "CHANGES_REQUESTED") changesRequested++;
          if (review.body && review.body.length > 0) commentsGiven++;
        }
      }
    }

    let score = 0;
    if (reviewsGiven >= 20) score += 40;
    else if (reviewsGiven >= 10) score += 30;
    else if (reviewsGiven >= 5) score += 20;
    else if (reviewsGiven >= 2) score += 10;

    if (commentsGiven >= 15) score += 30;
    else if (commentsGiven >= 8) score += 20;
    else if (commentsGiven >= 3) score += 10;

    if (approvalsGiven > 0 && changesRequested > 0) score += 30;
    else if (approvalsGiven > 0 || changesRequested > 0) score += 15;

    return {
      reviewsGiven,
      approvalsGiven,
      changesRequested,
      commentsGiven,
      score: Math.min(Math.round(score), 100),
    };
  } catch (err) {
    console.error("Error calculating review participation:", err.message);
    return {
      reviewsGiven: 0,
      approvalsGiven: 0,
      changesRequested: 0,
      commentsGiven: 0,
      score: 0,
    };
  }
};

const calculateCommitQuality = async (owner, repo, username, token) => {
  try {
    const { data: commits } = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/commits`,
      {
        params: {
          author: username,
          per_page: 50, // Reduced from 100
        },
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    let totalCommits = commits.length;
    let meaningfulCommits = 0;
    let totalFiles = 0;

    // Only check recent 20 commits for file details
    const recentCommits = commits.slice(0, 20);

    for (const commit of commits) {
      const message = commit.commit.message;
      
      if (
        message.length > 20 &&
        !message.toLowerCase().includes("wip") &&
        !message.toLowerCase().match(/^fix$/) &&
        !message.match(/^[0-9]+$/)
      ) {
        meaningfulCommits++;
      }
    }

    // Fetch commit details in parallel
    const commitDetailRequests = recentCommits.map(commit =>
      axios.get(commit.url, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          Authorization: `Bearer ${token}`,
        },
        timeout: 5000,
      }).catch(err => {
        console.error(`Error fetching commit details: ${err.message}`);
        return null;
      })
    );

    const commitResults = await batchRequests(commitDetailRequests, 10);

    let validCommits = 0;
    for (const result of commitResults) {
      if (result.status === 'fulfilled' && result.value?.data) {
        totalFiles += result.value.data.files?.length || 0;
        validCommits++;
      }
    }

    const meaningfulRate = totalCommits > 0 ? (meaningfulCommits / totalCommits) * 100 : 0;
    const avgFilesPerCommit = validCommits > 0 ? totalFiles / validCommits : 0;

    let score = 0;
    if (meaningfulRate >= 80) score += 50;
    else if (meaningfulRate >= 60) score += 40;
    else if (meaningfulRate >= 40) score += 30;
    else if (meaningfulRate >= 20) score += 20;

    if (avgFilesPerCommit <= 5) score += 50;
    else if (avgFilesPerCommit <= 10) score += 40;
    else if (avgFilesPerCommit <= 15) score += 30;
    else score += 20;

    return {
      totalCommits,
      meaningfulCommits,
      meaningfulRate: Math.round(meaningfulRate),
      avgFilesPerCommit: Math.round(avgFilesPerCommit * 10) / 10,
      score: Math.min(Math.round(score), 100),
    };
  } catch (err) {
    console.error("Error calculating commit quality:", err.message);
    return {
      totalCommits: 0,
      meaningfulCommits: 0,
      meaningfulRate: 0,
      avgFilesPerCommit: 0,
      score: 0,
    };
  }
};

export const getContributionScore = async (req, res) => {
  try {
    const { owner, repo, username } = req.params;
    const token = process.env.GITHUB_TOKEN;

    if (!owner || !repo || !username) {
      return res.status(400).json({ 
        error: "Owner, repo, and username parameters required" 
      });
    }

    console.log(`Calculating contribution score for ${username} in ${owner}/${repo}...`);

    // Verify user has contributions
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

    const isContributor = contributors.some(c => c.login === username);

    if (!isContributor) {
      return res.status(200).json({
        isContributor: false,
        username,
        owner,
        repo: `${owner}/${repo}`,
        message: "User has not contributed to this repository yet",
        overallScore: 0,
        impactLevel: "No Contributions",
        badge: "👋",
        recommendation: "Start contributing to this project! Create your first pull request, open an issue, or review code to begin your journey.",
        metrics: {
          prQuality: {
            totalPRs: 0,
            mergedPRs: 0,
            closedUnmergedPRs: 0,
            openPRs: 0,
            mergeRate: 0,
            totalAdditions: 0,
            totalDeletions: 0,
            avgReviewsPerPR: 0,
            complexityScore: 0,
            score: 0,
            weight: "35%",
          },
          issueManagement: {
            issuesOpened: 0,
            issuesClosed: 0,
            issuesResolved: 0,
            resolutionRate: 0,
            score: 0,
            weight: "25%",
          },
          reviewParticipation: {
            reviewsGiven: 0,
            approvalsGiven: 0,
            changesRequested: 0,
            commentsGiven: 0,
            score: 0,
            weight: "20%",
          },
          commitQuality: {
            totalCommits: 0,
            meaningfulCommits: 0,
            meaningfulRate: 0,
            avgFilesPerCommit: 0,
            score: 0,
            weight: "20%",
          },
        },
        breakdown: {
          prQualityScore: 0,
          issueScore: 0,
          reviewScore: 0,
          commitScore: 0,
        },
        summary: {
          totalPRs: 0,
          mergedPRs: 0,
          issuesOpened: 0,
          issuesResolved: 0,
          reviewsGiven: 0,
          totalCommits: 0,
        },
      });
    }

    // Calculate all metrics in parallel
    console.time('Metrics Calculation');
    const [prQuality, issueMetrics, reviewParticipation, commitQuality] = await Promise.all([
      calculatePRQuality(owner, repo, username, token),
      calculateIssueMetrics(owner, repo, username, token),
      calculateReviewParticipation(owner, repo, username, token),
      calculateCommitQuality(owner, repo, username, token),
    ]);
    console.timeEnd('Metrics Calculation');

    const overallScore = Math.round(
      prQuality.score * 0.35 +
      issueMetrics.score * 0.25 +
      reviewParticipation.score * 0.20 +
      commitQuality.score * 0.20
    );

    let impactLevel = "Beginner";
    let badge = "🌱";
    let recommendation = "Keep contributing! Focus on getting your PRs merged and engaging with the community.";

    if (overallScore >= 80) {
      impactLevel = "Elite Contributor";
      badge = "🏆";
      recommendation = "Outstanding contributions! You're a key member of this project. Consider mentoring others.";
    } else if (overallScore >= 65) {
      impactLevel = "Advanced Contributor";
      badge = "⭐";
      recommendation = "Great work! Your contributions are valuable. Keep up the quality and engagement.";
    } else if (overallScore >= 50) {
      impactLevel = "Intermediate Contributor";
      badge = "🚀";
      recommendation = "Good progress! Focus on code reviews and improving PR quality to reach the next level.";
    } else if (overallScore >= 30) {
      impactLevel = "Active Contributor";
      badge = "💪";
      recommendation = "You're on the right track! Work on writing meaningful commits and resolving issues.";
    }

    const contributionData = {
      isContributor: true,
      username,
      owner,
      repo,
      overallScore,
      impactLevel,
      badge,
      recommendation,
      metrics: {
        prQuality: {
          ...prQuality,
          weight: "35%",
        },
        issueManagement: {
          ...issueMetrics,
          weight: "25%",
        },
        reviewParticipation: {
          ...reviewParticipation,
          weight: "20%",
        },
        commitQuality: {
          ...commitQuality,
          weight: "20%",
        },
      },
      breakdown: {
        prQualityScore: prQuality.score,
        issueScore: issueMetrics.score,
        reviewScore: reviewParticipation.score,
        commitScore: commitQuality.score,
      },
      summary: {
        totalPRs: prQuality.totalPRs,
        mergedPRs: prQuality.mergedPRs,
        issuesOpened: issueMetrics.issuesOpened,
        issuesResolved: issueMetrics.issuesResolved,
        reviewsGiven: reviewParticipation.reviewsGiven,
        totalCommits: commitQuality.totalCommits,
      },
    };

    res.json(contributionData);
  } catch (err) {
    console.error("Error calculating contribution score:", err.message);
    res.status(500).json({
      error: "Failed to calculate contribution score",
      message: err.message,
    });
  }
};