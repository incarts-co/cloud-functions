import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { defineSecret } from "firebase-functions/params";
import * as functions from "firebase-functions/v2";

// Define secret for GitHub token
const GITHUB_TOKEN = defineSecret("GITHUB_TOKEN");

// Configuration - update these with your GitHub details
const GITHUB_CONFIG = {
  owner: "YOUR_GITHUB_USERNAME", // e.g., "johndoe"
  repo: "YOUR_REPO_NAME", // e.g., "my-project"
  apiUrl: "https://api.github.com"
};

// Interface for the document data
interface ReportData {
  title?: string;
  description?: string;
  userEmail?: string;
  category?: string;
  priority?: string;
  timestamp?: any;
  [key: string]: any;
}

/**
 * Creates a GitHub issue using REST API
 */
async function createGitHubIssue(
  data: ReportData,
  collectionName: string,
  token: string
): Promise<any> {
  // Prepare issue data
  const issueTitle = data.title || `New ${collectionName} report`;
  
  const issueBody = `
## Report Type
${collectionName === "bugReports" ? "🐛 Bug Report" : "💡 Feedback"}

## Description
${data.description || "No description provided"}

## Details
- **User Email**: ${data.userEmail || "Not provided"}
- **Category**: ${data.category || "General"}
- **Priority**: ${data.priority || "Medium"}
- **Submitted**: ${new Date().toISOString()}

## Additional Information
\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`;

  // Create labels based on collection type
  const labels: string[] = [];
  if (collectionName === "bugReports") {
    labels.push("bug");
    if (data.priority === "high") labels.push("priority:high");
  } else {
    labels.push("enhancement", "feedback");
  }

  // Make API request to create issue
  const response = await fetch(
    `${GITHUB_CONFIG.apiUrl}/repos/${GITHUB_CONFIG.owner}/${GITHUB_CONFIG.repo}/issues`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.json",
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
    const data = event.data?.data() as ReportData;
    
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
      
      functions.logger.info(`GitHub issue created: #${issue.number} - ${issue.title}`);
      return { 
        success: true, 
        issueNumber: issue.number, 
        issueUrl: issue.html_url 
      };
    } catch (error) {
      functions.logger.error("Error creating GitHub issue:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Failed to create GitHub issue: ${error}`,
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
    const data = event.data?.data() as ReportData;
    
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
      
      functions.logger.info(`GitHub issue created: #${issue.number} - ${issue.title}`);
      return { 
        success: true, 
        issueNumber: issue.number, 
        issueUrl: issue.html_url 
      };
    } catch (error) {
      functions.logger.error("Error creating GitHub issue:", error);
      throw new functions.https.HttpsError(
        "internal",
        `Failed to create GitHub issue: ${error}`,
      );
    }
  }
);