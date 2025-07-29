/**
 * Link Generation Cloud Function
 *
 * Version History:
 * v1.0.3 (May-15-2025) - Add staging.incarts.co to CORS allowed origins
 * v1.0.2 (Apr-29-2025) - Add backup products feature
 * v1.0.1 (Mar-11-2025) - Add rrd.incarts.co to CORs allowed origins
 *
 * This function handles the generation of various types of shoppable links:
 * - Custom URL links
 * - Product links (for different retailers)
 * - Shoppable page links
 *
 * It replaces the client-side link generation logic in the Flutter application.
 *
 * Backup Products Feature:
 * - useBackups: Boolean flag indicating backup products are enabled
 * - backupProducts: JSON string containing an array of objects with structure:
 *   { primaryId: string, backupIds: string[] }
 * - When a primary product is out of stock, the system will try backup products in order
 */

import { onRequest } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import axios from "axios";
import * as cors from "cors";

// Configure CORS
const corsHandler = cors({
  origin: [
    "http://localhost:3000",
    /^http:\/\/localhost:\d+$/,
    /^https:\/\/.*\.flutterflow\.app$/,
    /^https:\/\/.*\.incarts\.beta$/,
    /^https:\/\/rrd\.incarts\.co$/,
    /^https:\/\/beta\.incarts\.co$/,
    /^https:\/\/staging\.incarts\.co$/,
    // allow everything from us-central1.hosted.app and subdomains
    /^https:\/\/.*\.us-central1\.hosted\.app$/,
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
});

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Interface for the function input
interface GenerateLinkRequest {
  // Common parameters
  linkType: string; // "1", "2", or "3" (custom, product, or shoppable page)
  retailerStep?: number; // For linkType "1": 1=retailer selection, 2=custom link
  linkName: string; // Private name for the link
  publicLinkName?: string; // Optional public display name
  originalUrl?: string; // For custom URLs
  customUrl?: string; // Optional custom URL to save directly to the links document
  linkValue?: number; // Optional value for analytics (defaults to 0)
  utmParameters?: any; // UTM tracking parameters
  projectId: string; // Current project identifier
  projectName: string; // Project name
  userId: string; // User identifier for document creation
  linkTags?: string[]; // Tags associated with the link

  // For product links (linkType "2")
  selectedWebsite?: string; // Selected website name (Walmart.com, Instacart.com, etc.)
  selectedAction?: string; // Action type (Item Page, Shopping List, etc.)
  selectedRetailer?: string; // Selected retailer name (Walmart, Instacart, etc.)
  instacartRetailer?: string; // Optional Instacart retailer
  selectedProducts?: string[]; // Array of retailer product IDs

  // For shopping list (when selectedAction is "Shopping List")
  shoppingListData?: {
    title: string;
    imageUrl: string;
    instructions?: string;
    lineItems: any[];
  };

  // For recipe creation (when selectedAction is "Recipe")
  recipeData?: {
    title: string;
    image_url?: string;
    author?: string;
    servings?: number;
    cooking_time?: number;
    instructions?: string[];
    ingredients: Array<{
      name: string;
      display_text?: string;
      upcs?: string[];
      measurements?: Array<{
        quantity?: number;
        unit?: string;
      }>;
      filters?: {
        brand_filters?: string[];
        health_filters?: string[];
      };
    }>;
    landing_page_configuration?: {
      partner_linkback_url?: string;
      enable_pantry_items?: boolean;
    };
  };

  // For shoppable page (linkType "3")
  shoppablePageId?: string; // ID of selected shoppable page

  // For backup products feature
  useBackups?: boolean; // Flag indicating if backup products are enabled
  backupProducts?: string; // JSON string of backup product configurations
}

// Interface for the function response
// interface GenerateLinkResponse {
//   success: boolean;
//   shortLink?: string;         // Shortened URL
//   shortId?: string;           // Short ID for the URL
//   qrCodeUrl?: string;         // URL to the generated QR code
//   linkDocId?: string;         // ID of the created Firestore document
//   error?: string;             // Error message if success is false
// }

// Interface for the document data
interface LinkDocumentData {
  name: string;
  publicName: string;
  linkqrcodeimgurl: string;
  created: {
    userId: string;
    userRef: FirebaseFirestore.DocumentReference;
    timestamp: Date;
  };
  docId: string;
  shortlinkwithouthttps: string;
  linkactiveflag: boolean;
  projectDetails: {
    projectId: string;
    projectName: string;
    projectRef: FirebaseFirestore.DocumentReference;
  };
  longLink: string;
  urlShortCode: string;
  qrCode: string;
  shortLink: string;
  description: string;
  linkValue: number;
  pageType: string;
  utmParameters: any;
  linkTags: string[];
  siteplainname?: string;
  siteRetailer?: string;
  [key: string]: any; // Allow for additional fields
}

// Constants for API endpoints
const URL_SHORTENER_API =
  "https://incarts-url-shortener-qob6vapoca-uc.a.run.app/shorten";
const QR_CODE_GENERATOR_API =
  "https://us-central1-incarts.cloudfunctions.net/generateQRCode";

/**
 * Generate a unique document ID
 */
function generateUniqueId(length: number = 20): string {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Call the URL shortener API
 */
async function shortenUrl(
  originalUrl: string,
  linkType: string,
  projectId: string,
  linkTags: string[] = [],
  linkDocId: string
): Promise<any> {
  try {
    const response = await axios.post(URL_SHORTENER_API, {
      originalURL: originalUrl,
      linkType: linkType,
      projectId: projectId,
      linkTags: linkTags,
      linkDocId: linkDocId,
    });

    return {
      success: true,
      shortURL: response.data.shortURL,
      shortId: response.data.shortId,
    };
  } catch (error: any) {
    logger.error("Error shortening URL:", error);
    return {
      success: false,
      error: error.message || "Failed to shorten URL",
    };
  }
}

/**
 * Generate a QR code for a URL
 */
/**
 * Create an Instacart shopping list and return the products link URL
 */
async function createInstacartShoppingList(data: {
  title: string;
  imageUrl: string;
  instructions?: string;
  lineItems: any[];
}): Promise<string> {
  try {
    const requestBody: any = {
      title: data.title,
      image_url: data.imageUrl,
      link_type: "shopping_list",
      line_items: data.lineItems,
      landing_page_configuration: {
        partner_linkback_url: "beta.incarts.co",
        enable_pantry_items: true,
      },
    };

    // Only add instructions if provided
    if (data.instructions) {
      requestBody.instructions = [data.instructions];
    }

    // live instacart url
    // https://connect.instacart.com/idp/v1/products/products_link

    // testing instacart url
    // https://connect.dev.instacart.tools/idp/v1/products/products_link

    const response = await axios.post(
      "https://connect.instacart.com/idp/v1/products/products_link",
      requestBody,
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-CA",
          "Content-Type": "application/json",
          Authorization:
            "Bearer keys.lLRxMEjBL9tp3VLVnDI4p2BDV5Bksjk2patIO0YAjL4",
        },
      }
    );

    return response.data.products_link_url;
  } catch (error: any) {
    logger.error("Error creating Instacart shopping list:", error);
    throw new Error(
      `Failed to create Instacart shopping list: ${error.message}`
    );
  }
}

/**
 * Create an Instacart recipe and return the recipe URL
 */
async function createInstacartRecipe(
  recipeData: {
    title: string;
    image_url?: string;
    author?: string;
    servings?: number;
    cooking_time?: number;
    instructions?: string[];
    ingredients: any[];
    landing_page_configuration?: any;
  },
  retailer?: string
): Promise<string> {
  try {
    const requestBody: any = {
      title: recipeData.title,
      link_type: "recipe",
      ingredients: recipeData.ingredients,
      landing_page_configuration: {
        partner_linkback_url: "beta.incarts.co",
        enable_pantry_items: true,
        ...recipeData.landing_page_configuration,
      },
    };

    // Add optional fields if they exist
    if (recipeData.image_url) {
      requestBody.image_url = recipeData.image_url;
    }
    if (recipeData.author) {
      requestBody.author = recipeData.author;
    }
    if (recipeData.servings) {
      requestBody.servings = recipeData.servings;
    }
    if (recipeData.cooking_time) {
      requestBody.cooking_time = recipeData.cooking_time;
    }
    if (recipeData.instructions && recipeData.instructions.length > 0) {
      requestBody.instructions = recipeData.instructions;
    }


    // Call Instacart Recipe API
    const response = await axios.post(
      "https://connect.instacart.com/idp/v1/products/recipe",
      requestBody,
      {
        headers: {
          Accept: "application/json",
          "Accept-Language": "en-CA",
          "Content-Type": "application/json",
          Authorization:
            "Bearer keys.lLRxMEjBL9tp3VLVnDI4p2BDV5Bksjk2patIO0YAjL4", // Same as shopping list
        },
      }
    );

    let recipeUrl = response.data.products_link_url;

    // Manually append retailer_key to URL if provided
    if (retailer) {
      const separator = recipeUrl.includes('?') ? '&' : '?';
      recipeUrl += `${separator}retailer_key=${retailer}`;
      logger.info(`Appended retailer_key to recipe URL: ${recipeUrl}`);
    }

    return recipeUrl;
  } catch (error: any) {
    logger.error("Error creating Instacart recipe:", error);
    throw new Error(
      `Failed to create Instacart recipe: ${error.message}`
    );
  }
}

async function generateQrCode(url: string): Promise<any> {
  try {
    const response = await axios.post(QR_CODE_GENERATOR_API, { url });

    return {
      success: true,
      publicUrl: response.data.publicUrl,
    };
  } catch (error: any) {
    logger.error("Error generating QR code:", error);
    return {
      success: false,
      error: error.message || "Failed to generate QR code",
    };
  }
}

/**
 * Create a link document in Firestore
 */
async function createLinkDocument(data: any): Promise<any> {
  try {
    const docRef = db.collection("links").doc(data.docId);
    await docRef.set(data);

    return {
      success: true,
      docId: data.docId,
    };
  } catch (error: any) {
    logger.error("Error creating link document:", error);
    return {
      success: false,
      error: error.message || "Failed to create link document",
    };
  }
}

/**
 * Generate a link URL based on retailer and product information
 */
async function generateLinkUrl(
  selectedWebsite: string,
  selectedAction: string,
  selectedProducts: any[],
  instacartRetailer?: string,
  shoppingListData?: {
    title: string;
    imageUrl: string;
    instructions?: string;
    lineItems: any[];
  },
  recipeData?: {
    title: string;
    image_url?: string;
    author?: string;
    servings?: number;
    cooking_time?: number;
    instructions?: string[];
    ingredients: any[];
    landing_page_configuration?: any;
  },
  useBackups?: boolean
): Promise<string> {
  if (selectedWebsite === "Walmart.com") {
    if (selectedAction === "Add Items to Cart") {
      // Always use items parameter for Walmart add to cart URLs
      let itemIds: string;
      
      if (useBackups) {
        // For backup products flow, extract just the primary IDs
        itemIds = selectedProducts
          .map((product: any) => product.primaryId)
          .join(",");
      } else {
        // Standard flow - use product IDs directly
        itemIds = selectedProducts.join(",");
      }

      // Always use the affil.walmart.com domain with items parameter
      const url = `https://affil.walmart.com/cart/addToCart?items=${itemIds}`;

      logger.info("Generated Walmart cart URL", {
        useBackups: useBackups || false,
        itemIds,
        selectedProducts,
        url,
      });

      return url;
    } else {
      // Item Page logic
      // Handle both regular products and backup products structure
      const productId = typeof selectedProducts[0] === 'object' && selectedProducts[0].primaryId
        ? selectedProducts[0].primaryId
        : selectedProducts[0];
      return `https://www.walmart.com/ip/${productId}`;
    }
  } else if (selectedWebsite === "Instacart.com") {
    if (selectedAction === "Item Page") {
      // For Instacart item pages
      const productId = selectedProducts[0];

      if (instacartRetailer) {
        return `https://www.instacart.com/products/${productId}?retailerSlug=${instacartRetailer}`;
      } else {
        return `https://www.instacart.com/products/${productId}`;
      }
    } else if (selectedAction === "Shopping List" && shoppingListData) {
      // Call Instacart API to create shopping list
      return await createInstacartShoppingList(shoppingListData);
    } else if (selectedAction === "Recipe" && recipeData) {
      // Call Instacart API to create recipe
      return await createInstacartRecipe(recipeData, instacartRetailer);
    }
  } else if (selectedWebsite === "Amazon.com") {
    if (selectedAction === "Item Page") {
      // Simple product page URL
      return `https://www.amazon.com/dp/${selectedProducts[0]}`;
    } else {
      // Add to Cart URL
      const productParams = selectedProducts
        .map(
          (productId, index) =>
            `ASIN.${index + 1}=${productId}&Quantity.${index + 1}=1`
        )
        .join("&");

      return `https://www.amazon.com/gp/aws/cart/add.html?AssociateTag=incarts07-20&${productParams}`;
    }
  } else if (selectedWebsite === "Kroger.com") {
    // Generate Kroger URL
    return `https://www.kroger.com/p/-/${selectedProducts[0]}`;
  }

  return "";
}

/**
 * Main function handler for link generation
 */
export const generateLinkHttp = onRequest(
  {
    region: "us-central1",
    memory: "512MiB",
  },
  async (request, response) => {
    // Wrap the function in cors middleware
    return new Promise((resolve) => {
      corsHandler(request, response, async () => {
        try {
          const data: GenerateLinkRequest = request.body.data || request.body;
          logger.info("Link generation request received", {
            data,
            linkType: data.linkType,
            retailerStep: data.retailerStep,
            originalUrl: data.originalUrl,
            customUrl: data.customUrl,
            useBackups: data.useBackups,
          });

          // Validate required parameters
          const missingParams = [];
          if (!data.linkType) missingParams.push("linkType");
          if (!data.linkName) missingParams.push("linkName");
          if (!data.projectId) missingParams.push("projectId");
          if (!data.projectName) missingParams.push("projectName");
          if (!data.userId) missingParams.push("userId");

          if (missingParams.length > 0) {
            response.status(400).json({
              success: false,
              error: `Missing required parameters: ${missingParams.join(", ")}`,
            });
            return;
          }

          // Generate a unique document ID
          const linkDocId = generateUniqueId();

          // Handle different link types
          let originalUrl = "";
          let linkTypeLabel = "";

          if (data.linkType === "1") {
            // Custom URL flow
            if (data.retailerStep === 2) {
              // Custom URL
              logger.info("Processing custom URL with retailerStep 2", {
                originalUrl: data.originalUrl,
                linkName: data.linkName,
                publicLinkName: data.publicLinkName || "Not provided",
                projectId: data.projectId,
                projectName: data.projectName,
                linkTags: data.linkTags || [],
                linkValue: data.linkValue || 0,
              });

              if (!data.originalUrl) {
                response.status(400).json({
                  success: false,
                  error:
                    "Original URL is required for custom links (retailerStep 2)",
                });
                return;
              }

              originalUrl = data.originalUrl;
              linkTypeLabel = "Custom Link";

              logger.info("Custom URL successfully processed", {
                linkTypeLabel,
                originalUrl,
                timestamp: new Date().toISOString(),
              });
            } else if (data.retailerStep === 1) {
              // Retailer selection flow
              if (!data.originalUrl) {
                response.status(400).json({
                  success: false,
                  error: "Original URL is required for retailer links",
                });
                return;
              }

              originalUrl = data.originalUrl;
              linkTypeLabel = "Retailer Link";
            }
          } else if (data.linkType === "2") {
            // Product flow
            if (!data.selectedWebsite || !data.selectedAction) {
              response.status(400).json({
                success: false,
                error: "Website and action are required for product links",
              });
              return;
            }

            // Validate based on action type
            if (data.selectedAction === "Shopping List") {
              if (!data.shoppingListData) {
                response.status(400).json({
                  success: false,
                  error:
                    "Shopping list data is required for Shopping List action",
                });
                return;
              }

              const { title, imageUrl, lineItems } = data.shoppingListData;
              if (
                !title ||
                !imageUrl ||
                !lineItems ||
                !Array.isArray(lineItems) ||
                lineItems.length === 0
              ) {
                response.status(400).json({
                  success: false,
                  error:
                    "Invalid shopping list data: title, imageUrl, and lineItems are required",
                });
                return;
              }
            } else if (data.selectedAction === "Recipe") {
              if (!data.recipeData) {
                response.status(400).json({
                  success: false,
                  error: "Recipe data is required for Recipe action",
                });
                return;
              }

              const { title, ingredients } = data.recipeData;
              if (!title || !ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
                response.status(400).json({
                  success: false,
                  error: "Invalid recipe data: title and ingredients are required",
                });
                return;
              }
            } else if (
              !data.selectedProducts ||
              data.selectedProducts.length === 0
            ) {
              response.status(400).json({
                success: false,
                error: "Products are required for this action type",
              });
              return;
            }

            // Generate the link URL based on the retailer and products
            originalUrl = await generateLinkUrl(
              data.selectedWebsite,
              data.selectedAction,
              data.selectedProducts || [],
              data.instacartRetailer,
              data.shoppingListData,
              data.recipeData,
              data.useBackups
            );

            linkTypeLabel = data.selectedAction;
          } else if (data.linkType === "3") {
            // Shoppable page flow - Updated Logic
            if (!data.shoppablePageId) {
              response.status(400).json({
                success: false,
                error: "Shoppable page ID is required for page links",
              });
              return;
            }

            linkTypeLabel = "Shoppable Page"; // Set label early

            try {
              // 1. Query newDynamicPages collection
              const pageQuery = db
                .collection("newDynamicPages")
                .where("pageId", "==", data.shoppablePageId)
                .limit(1);
              const pageSnapshot = await pageQuery.get();

              if (pageSnapshot.empty) {
                response.status(404).json({
                  success: false,
                  error: `Shoppable page with ID ${data.shoppablePageId} not found.`,
                });
                return;
              }

              const pageDocData = pageSnapshot.docs[0].data();
              const pageUrl = pageDocData.pageUrl; // e.g., https://in2carts.web.app/standard5

              if (!pageUrl) {
                response.status(500).json({
                  success: false,
                  error: `Missing pageUrl for shoppable page ID ${data.shoppablePageId}.`,
                });
                return;
              }

              // 2. Query links collection using the pageUrl
              const linkQuery = db
                .collection("links")
                .where("shortLink", "==", pageUrl)
                .limit(1);
              const linkSnapshot = await linkQuery.get();

              if (linkSnapshot.empty) {
                response.status(404).json({
                  success: false,
                  error: `Original link record for page URL ${pageUrl} not found.`,
                });
                return;
              }

              const linkDocData = linkSnapshot.docs[0].data();
              originalUrl = linkDocData.longLink; // This is the target URL for the new link

              if (!originalUrl) {
                response.status(500).json({
                  success: false,
                  error: `Missing longLink in the original link record for page URL ${pageUrl}.`,
                });
                return;
              }

              logger.info("Found target longLink for Shoppable Page", {
                shoppablePageId: data.shoppablePageId,
                pageUrl: pageUrl,
                originalUrl: originalUrl,
              });
            } catch (dbError: any) {
              logger.error(
                "Database error fetching shoppable page details:",
                dbError
              );
              response.status(500).json({
                success: false,
                error: `Database error fetching details for shoppable page: ${dbError.message}`,
              });
              return;
            }
          }

          // Ensure originalUrl was determined before proceeding
          if (!originalUrl) {
            response.status(400).json({
              success: false,
              error: "Failed to generate original URL",
            });
            return;
          }

          // Shorten the URL
          const shortenResult = await shortenUrl(
            originalUrl,
            linkTypeLabel,
            data.projectId,
            data.linkTags || [],
            linkDocId
          );

          if (!shortenResult.success) {
            response.status(500).json({
              success: false,
              error: `Failed to shorten URL: ${shortenResult.error}`,
            });
            return;
          }

          // Generate QR code
          const qrResult = await generateQrCode(shortenResult.shortURL);

          if (!qrResult.success) {
            response.status(500).json({
              success: false,
              error: `Failed to generate QR code: ${qrResult.error}`,
            });
            return;
          }

          // Determine page type
          let pageType = "Link"; // Default
          if (
            data.linkType === "2" &&
            data.selectedAction === "Add Items to Cart"
          ) {
            pageType = "ATC";
          }

          // Create document data
          const timestamp = new Date();
          const documentData: LinkDocumentData = {
            name: data.linkName,
            publicName: data.publicLinkName || "",
            linkqrcodeimgurl: qrResult.publicUrl,
            created: {
              userId: data.userId,
              userRef: db.doc(`users/${data.userId}`),
              timestamp: timestamp,
            },
            docId: linkDocId,
            shortlinkwithouthttps: shortenResult.shortURL,
            linkactiveflag: true,
            projectDetails: {
              projectId: data.projectId,
              projectName: data.projectName,
              projectRef: db.doc(`projects/${data.projectId}`),
            },
            longLink: originalUrl,
            urlShortCode: shortenResult.shortId,
            qrCode: qrResult.publicUrl,
            shortLink: shortenResult.shortURL,
            description: "-",
            linkValue: data.linkValue || 0,
            pageType: pageType,
            utmParameters: data.utmParameters || {},
            linkTags: data.linkTags || [],
          };

          // Add custom URL if provided
          if (data.customUrl) {
            documentData.customUrl = data.customUrl;
          }

          // Add retailer-specific fields if applicable
          if (data.linkType === "2") {
            // Set default siteplainname based on selectedWebsite if selectedRetailer is not provided
            let defaultRetailer;
            switch (data.selectedWebsite) {
              case "Walmart.com":
                defaultRetailer = "Walmart";
                break;
              case "Amazon.com":
                defaultRetailer = "Amazon";
                break;
              case "Kroger.com":
                defaultRetailer = "Kroger";
                break;
              case "Instacart.com":
                defaultRetailer = "Instacart";
                break;
            }

            documentData.siteplainname =
              data.selectedRetailer || defaultRetailer || "";
            documentData.siteRetailer = data.instacartRetailer || "";
          }

          // Add backup products data if provided
          if (data.useBackups) {
            documentData.useBackups = data.useBackups;

            // Parse backupProducts from string to JSON object if it's a string
            if (
              data.backupProducts &&
              typeof data.backupProducts === "string"
            ) {
              try {
                // Parse the JSON string into an actual object
                const parsedBackupProducts = JSON.parse(data.backupProducts);
                documentData.backupProducts = parsedBackupProducts;

                logger.info("Successfully parsed backupProducts JSON", {
                  parsedBackupProducts,
                });
              } catch (e) {
                logger.error("Error parsing backupProducts JSON", {
                  backupProducts: data.backupProducts,
                  error: e,
                });
                // Still store the original string if parsing fails
                documentData.backupProducts = data.backupProducts;
              }
            } else {
              // If it's not a string (already an object), store as is
              documentData.backupProducts = data.backupProducts;
            }
          }

          // Create the document in Firestore
          const createResult = await createLinkDocument(documentData);

          if (!createResult.success) {
            response.status(500).json({
              success: false,
              error: `Failed to create link document: ${createResult.error}`,
            });
            return;
          }

          // Return the success response
          response.json({
            success: true,
            shortLink: shortenResult.shortURL,
            shortId: shortenResult.shortId,
            qrCodeUrl: qrResult.publicUrl,
            linkDocId: linkDocId,
          });
        } catch (error: any) {
          response.status(500).json({
            success: false,
            error: error.message || "An unexpected error occurred",
          });
        }
        resolve();
      });
    });
  }
);
