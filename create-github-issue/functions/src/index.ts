import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as functions from "firebase-functions/v2";

// Define secret for GitHub token
const GITHUB_TOKEN = defineSecret("GITHUB_TOKEN_INCARTS_NEXT");

// Configuration - update these with your GitHub details
const GITHUB_CONFIG = {
  owner: "incarts-co", // e.g., "johndoe"
  repo: "incarts-next", // e.g., "my-project"
  apiUrl: "https://api.github.com",
};

// Interface for bug report data
interface BugReport {
  title?: string;
  description?: string;
  userEmail?: string;
  userId?: string;
  projectId?: string;
  projectName?: string;
  severity?: string;
  status?: string;
  expectedBehavior?: string;
  actualBehavior?: string;
  stepsToReproduce?: string;
  pageUrl?: string;
  screenshots?: string[];
  timestamp?: any;
  userAgent?: string;
  browserInfo?: {
    cookiesEnabled?: boolean;
    language?: string;
    platform?: string;
    screenResolution?: string;
    windowSize?: string;
  };
  [key: string]: any;
}

// Interface for feedback data
interface Feedback {
  message?: string;
  type?: string;
  userEmail?: string;
  userId?: string;
  projectId?: string;
  projectName?: string;
  status?: string;
  pageUrl?: string;
  timestamp?: any;
  userAgent?: string;
  [key: string]: any;
}

/**
 * Creates a GitHub issue using REST API
 */
async function createGitHubIssue(
  data: BugReport | Feedback,
  collectionName: string,
  token: string
): Promise<any> {
  // Prepare issue data based on collection type
  let issueTitle: string;
  let issueBody: string;
  
  if (collectionName === "bugReports") {
    const bugData = data as BugReport;
    issueTitle = bugData.title || `New bug report`;
    
    issueBody = `
## Bug Report

**Title:** ${bugData.title || "Not provided"}
**User:** ${bugData.userEmail || "Not provided"}
**Project:** ${bugData.projectName || "Not provided"}
**Severity:** ${bugData.severity || "Not provided"}
**Status:** ${bugData.status || "new"}

**Description:**
${bugData.description || "No description provided"}

**Expected Behavior:**
${bugData.expectedBehavior || "Not provided"}

**Actual Behavior:**
${bugData.actualBehavior || "Not provided"}

**Steps to Reproduce:**
${bugData.stepsToReproduce || "Not provided"}

**Page URL:** ${bugData.pageUrl || "Not provided"}
**Timestamp:** ${bugData.timestamp?.__time__ || bugData.timestamp || new Date().toISOString()}

${bugData.screenshots && bugData.screenshots.length > 0 ? `**Screenshots:**
${bugData.screenshots.map(url => `- ${url}`).join('\n')}` : ''}

**Browser Info:**
- User Agent: ${bugData.userAgent || "Not provided"}
${bugData.browserInfo ? `- Screen Resolution: ${bugData.browserInfo.screenResolution || "Not provided"}
- Platform: ${bugData.browserInfo.platform || "Not provided"}
- Language: ${bugData.browserInfo.language || "Not provided"}` : ''}

## Full Data
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`;
  } else {
    const feedbackData = data as Feedback;
    issueTitle = `Feedback: ${feedbackData.type || "general"}`;
    
    issueBody = `
## Feedback

**Type:** ${feedbackData.type || "Not provided"}
**User:** ${feedbackData.userEmail || "Not provided"}
**Project:** ${feedbackData.projectName || "Not provided"}
**Status:** ${feedbackData.status || "new"}

**Message:**
${feedbackData.message || "No message provided"}

**Page URL:** ${feedbackData.pageUrl || "Not provided"}
**Timestamp:** ${feedbackData.timestamp?.__time__ || feedbackData.timestamp || new Date().toISOString()}

**Browser:**
${feedbackData.userAgent || "Not provided"}

## Full Data
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`;
  }

  // Create labels based on collection type
  const labels: string[] = [];
  if (collectionName === "bugReports") {
    labels.push("user-sumissions", "bug");
    if (data.priority === "high") labels.push("priority:high");
  } else {
    labels.push("user-sumissions", "feedback");
  }

  // Make API request to create issue
  const response = await fetch(
    `${GITHUB_CONFIG.apiUrl}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/issues`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: issueTitle,
        body: issueBody,
        labels: labels,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Cloud Function v2 triggered when a document is created in bugReports collection
 */
export const onBugReportCreated = onDocumentCreated(
  {
    document: "bugReports/{docId}",
    secrets: [GITHUB_TOKEN],
    region: "us-central1", // Change to your preferred region
  },
  async (event) => {
    const data = event.data?.data() as BugReport;

    if (!data) {
      functions.logger.error("No data found in document");
      return;
    }

    try {
      // Create GitHub issue
      const issue = await createGitHubIssue(
        data,
        "bugReports",
        GITHUB_TOKEN.value()
      );

      functions.logger.info(
        `GitHub issue created: #${issue.number} - ${issue.title}`
      );
      return {
        success: true,
        issueNumber: issue.number,
        issueUrl: issue.html_url,
      };
    } catch (error) {
      functions.logger.error("Error creating GitHub issue:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Failed to create GitHub issue: ${error}`
      );
    }
  }
);

/**
 * Cloud Function v2 triggered when a document is created in feedback collection
 */
export const onFeedbackCreated = onDocumentCreated(
  {
    document: "feedback/{docId}",
    secrets: [GITHUB_TOKEN],
    region: "us-central1", // Change to your preferred region
  },
  async (event) => {
    const data = event.data?.data() as Feedback;

    if (!data) {
      functions.logger.error("No data found in document");
      return;
    }

    try {
      // Create GitHub issue
      const issue = await createGitHubIssue(
        data,
        "feedback",
        GITHUB_TOKEN.value()
      );

      functions.logger.info(
        `GitHub issue created: #${issue.number} - ${issue.title}`
      );
      return {
        success: true,
        issueNumber: issue.number,
        issueUrl: issue.html_url,
      };
    } catch (error) {
      functions.logger.error("Error creating GitHub issue:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Failed to create GitHub issue: ${error}`
      );
    }
  }
);
