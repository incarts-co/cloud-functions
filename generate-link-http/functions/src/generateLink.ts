/**
 * Link Generation Cloud Function
 *
 * Version History:
 * v1.0.5 (Jul-29-2025) - SECURITY FIX: Replace remaining hardcoded API keys with environment variables for shopping lists and recipes
 * v1.0.4 (Jul-29-2025) - SECURITY FIX: Remove hardcoded API key, use environment variable
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
  backupProducts?: string | NormalizedBackupProduct[] | Record<string, any> | Array<Record<string, any>>; // Backup configurations

  // For default QR code customization
  defaultQRIdentifier?: string; // Custom identifier for the default QR code
  defaultQRName?: string; // Custom display name for the default QR code

  // Walmart add-to-cart preferences and advanced options
  walmartAllowPdp?: boolean; // Enable Walmart PDP fulfillment for single-item carts
  walmartCartMode?: string; // Preferred Walmart cart mode
  allowPdp?: boolean; // Explicit allow PDP flag
  allow_pdp?: boolean; // Legacy allow PDP flag
  fallbackUrl?: string; // Optional fallback URL alias
  redirectUrl?: string; // Optional redirect URL alias
  cartUrlOptions?: CartUrlOptions | string; // Advanced Walmart cart configuration
  cartOptions?: CartUrlOptions | string; // Alias for cartUrlOptions
  cartDefaults?: CartUrlOptions | string; // Alias for default cart options
  cartUrlConfig?: CartUrlOptions | string; // Alias for cart configuration
  storeId?: string; // Preferred store identifier
  defaultStoreId?: string; // Default store identifier
  preferredStoreId?: string; // Preferred store identifier alias
  smartCart?: {
    cartUrlOptions?: CartUrlOptions | string;
    cartOptions?: CartUrlOptions | string;
    storeId?: string;
    defaultStoreId?: string;
    preferredStoreId?: string;
    [key: string]: any;
  };
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

type CartUrlOptions = {
  mode?: string;
  fallbackMode?: string;
  includeStoreId?: string;
  preferItemsForWalmart?: boolean;
  preferOffersForMarketplace?: boolean;
  [key: string]: any;
};

type NormalizedBackupProduct = {
  primaryId: string;
  backupIds: string[];
  quantity?: number;
};

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

function isPlainObject(value: any): value is Record<string, any> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function safeParseJson<T = any>(value: string, context: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    logger.error(`Failed to parse ${context}`, { value, error });
    return null;
  }
}

function firstString(...values: any[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return undefined;
}

function extractProductIdentifier(input: any): string | undefined {
  if (!input) {
    return undefined;
  }

  if (typeof input === "string" && input.trim().length > 0) {
    return input.trim();
  }

  if (!isPlainObject(input)) {
    return undefined;
  }

  const candidate =
    input.retailerItemId ??
    input.primaryId ??
    input.primaryItemId ??
    input.itemId ??
    input.productId ??
    input.id ??
    input.shortId ??
    input.urlShortCode ??
    input.urlShortcode ??
    input.shortcode ??
    input.url_short_code;

  if (typeof candidate === "string" && candidate.trim().length > 0) {
    return candidate.trim();
  }

  return undefined;
}

function extractPrimaryProductIds(products: any): string[] {
  if (!Array.isArray(products)) {
    return [];
  }

  return products
    .map((product: any) => {
      if (isPlainObject(product) && product.primary) {
        return extractProductIdentifier(product.primary);
      }

      return extractProductIdentifier(product);
    })
    .filter((value: string | undefined): value is string => Boolean(value));
}

function normalizeBackupEntry(entry: any): NormalizedBackupProduct | null {
  if (!entry) {
    return null;
  }

  if (typeof entry === "string") {
    const trimmed = entry.trim();
    if (!trimmed) {
      return null;
    }
    return { primaryId: trimmed, backupIds: [] };
  }

  const primaryId =
    (typeof entry.primaryId === "string" && entry.primaryId.trim()) ||
    (typeof entry.primaryItemId === "string" && entry.primaryItemId.trim()) ||
    extractProductIdentifier(entry.primary) ||
    extractProductIdentifier(entry);

  if (!primaryId) {
    return null;
  }

  let backupIds: string[] = [];

  if (Array.isArray(entry.backupIds)) {
    backupIds = entry.backupIds
      .map((value: unknown) => extractProductIdentifier(value))
      .filter((value: string | undefined): value is string => Boolean(value));
  } else if (Array.isArray(entry.backups)) {
    backupIds = entry.backups
      .map((value: unknown) => extractProductIdentifier(value))
      .filter((value: string | undefined): value is string => Boolean(value));
  }

  const uniqueBackupIds = Array.from(new Set(backupIds));

  const quantityCandidate =
    entry.quantity ??
    entry.primaryQuantity ??
    (isPlainObject(entry.primary) ? entry.primary.quantity : undefined);

  let normalizedQuantity: number | undefined;
  if (typeof quantityCandidate === "number") {
    normalizedQuantity = quantityCandidate;
  } else if (
    typeof quantityCandidate === "string" &&
    quantityCandidate.trim().length > 0
  ) {
    const parsed = parseFloat(quantityCandidate);
    if (!Number.isNaN(parsed)) {
      normalizedQuantity = parsed;
    }
  }

  const normalized: NormalizedBackupProduct = {
    primaryId,
    backupIds: uniqueBackupIds,
  };

  if (typeof normalizedQuantity === "number" && normalizedQuantity > 0) {
    normalized.quantity = normalizedQuantity;
  }

  return normalized;
}

function normalizeBackupProducts(
  raw: GenerateLinkRequest["backupProducts"]
): NormalizedBackupProduct[] | undefined {
  if (!raw) {
    return undefined;
  }

  let parsed: any = raw;

  if (typeof raw === "string") {
    const parsedValue = safeParseJson<any>(raw, "backupProducts payload");
    if (!parsedValue) {
      return undefined;
    }
    parsed = parsedValue;
  }

  if (isPlainObject(parsed) && Array.isArray(parsed.backupProducts)) {
    parsed = parsed.backupProducts;
  } else if (isPlainObject(parsed) && Array.isArray(parsed.requestBackups)) {
    parsed = parsed.requestBackups;
  }

  if (!Array.isArray(parsed)) {
    parsed = [parsed];
  }

  const normalized: NormalizedBackupProduct[] = [];

  for (const entry of parsed) {
    const normalizedEntry = normalizeBackupEntry(entry);
    if (normalizedEntry) {
      normalized.push(normalizedEntry);
    }
  }

  return normalized.length > 0 ? normalized : undefined;
}

function coerceBoolean(value: any): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
    }
  }

  return undefined;
}

function createUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch (_error) {
    try {
      return new URL(value, "https://in2carts.com");
    } catch (innerError) {
      logger.error("Failed to parse URL", { value, error: innerError });
      return null;
    }
  }
}

function deriveAllowPdpFlag(
  data: GenerateLinkRequest,
  longLink: string
): boolean | undefined {
  const explicit = coerceBoolean(
    data.allowPdp ?? data.allow_pdp ?? data.walmartAllowPdp
  );

  if (typeof explicit === "boolean") {
    return explicit;
  }

  const parsedUrl = createUrl(longLink);
  if (!parsedUrl) {
    return undefined;
  }

  const param = parsedUrl.searchParams.get("allow_pdp");
  return coerceBoolean(param);
}

function removeUndefinedKeys<T extends Record<string, any>>(input: T): T {
  Object.keys(input).forEach((key) => {
    if (input[key] === undefined) {
      delete input[key];
    }
  });
  return input;
}

function extractCartUrlOptions(
  data: GenerateLinkRequest
): CartUrlOptions | undefined {
  const defaults: CartUrlOptions = {
    mode: "auto",
    fallbackMode: "items",
    includeStoreId: "auto",
    preferItemsForWalmart: data.walmartCartMode === "offer" ? false : true,
    preferOffersForMarketplace: data.walmartCartMode === "offer",
  };

  const candidates = [
    data.cartUrlOptions,
    data.cartOptions,
    data.cartDefaults,
    data.cartUrlConfig,
    isPlainObject(data.smartCart) ? data.smartCart.cartUrlOptions : undefined,
    isPlainObject(data.smartCart) ? data.smartCart.cartOptions : undefined,
  ];

  const merged: CartUrlOptions = { ...defaults };
  let hasOverrides = false;

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    let parsedCandidate: any = candidate;

    if (typeof candidate === "string") {
      parsedCandidate = safeParseJson<CartUrlOptions>(
        candidate,
        "cartUrlOptions payload"
      );
    }

    if (parsedCandidate && isPlainObject(parsedCandidate)) {
      Object.assign(merged, parsedCandidate);
      hasOverrides = true;
    }
  }

  return removeUndefinedKeys(hasOverrides ? merged : { ...defaults });
}

function extractStorePreferences(data: GenerateLinkRequest) {
  const smartCart = isPlainObject(data.smartCart) ? data.smartCart : undefined;

  const storeId = firstString(data.storeId, smartCart?.storeId);
  const defaultStoreId = firstString(
    data.defaultStoreId,
    smartCart?.defaultStoreId
  );
  const preferredStoreId = firstString(
    data.preferredStoreId,
    smartCart?.preferredStoreId
  );

  const result: Record<string, string> = {};

  if (storeId) {
    result.storeId = storeId;
  }
  if (defaultStoreId) {
    result.defaultStoreId = defaultStoreId;
  }
  if (preferredStoreId) {
    result.preferredStoreId = preferredStoreId;
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
}, retailer?: string): Promise<string> {
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
          Authorization: `Bearer ${process.env.INSTACART_API_KEY}`,
        },
      }
    );

    let shoppingListUrl = response.data.products_link_url;

    // Manually append retailer_key to URL if provided
    if (retailer) {
      const separator = shoppingListUrl.includes('?') ? '&' : '?';
      shoppingListUrl += `${separator}retailer_key=${retailer}`;
      logger.info(`Appended retailer_key to shopping list URL: ${shoppingListUrl}`);
    }

    return shoppingListUrl;
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
          Authorization: `Bearer ${process.env.INSTACART_API_KEY}`, // Same as shopping list
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
  useBackups?: boolean,
  walmartAllowPdp?: boolean | string | number
): Promise<string> {
  const primaryProductIds = extractPrimaryProductIds(selectedProducts);

  if (selectedWebsite === "Walmart.com") {
    if (selectedAction === "Add Items to Cart") {
      // Always use items parameter for Walmart add to cart URLs
      const itemIds = primaryProductIds.join(",");

      if (!itemIds) {
        logger.warn("Unable to derive Walmart item IDs for link generation", {
          useBackups: useBackups || false,
          selectedProducts,
        });
        return "";
      }

      // Always use the affil.walmart.com domain with items parameter
      let url = `https://affil.walmart.com/cart/addToCart?items=${itemIds}`;

      const allowPdpRequested = coerceBoolean(walmartAllowPdp);
      const isSinglePrimaryItem = !useBackups && primaryProductIds.length === 1;

      if (allowPdpRequested && isSinglePrimaryItem) {
        const separator = url.includes("?") ? "&" : "?";
        url += `${separator}allow_pdp=true`;
      }

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
      const productId = primaryProductIds[0];

      if (!productId) {
        logger.warn("Missing primary product ID for Walmart item page", {
          selectedProducts,
        });
        return "";
      }
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
      return await createInstacartShoppingList(shoppingListData, instacartRetailer);
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

          // Normalize and validate backup configuration early.
          // This allows us to treat backups as optional when mappings are empty.
          const normalizedBackupProducts = normalizeBackupProducts(
            data.backupProducts
          );
          const hasBackupProductIds =
            Array.isArray(normalizedBackupProducts) &&
            normalizedBackupProducts.some(
              (entry) =>
                Array.isArray(entry.backupIds) && entry.backupIds.length > 0
            );
          const useBackupsEffective = Boolean(
            data.useBackups && hasBackupProductIds
          );

          if (data.useBackups && !useBackupsEffective) {
            logger.info("Backup mode requested without backup mappings", {
              action: "skip_backup_flow",
              hasBackupProductIds,
              rawBackupProducts: data.backupProducts,
            });
          }

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

            const allowPdpRequest =
              data.allowPdp ?? data.allow_pdp ?? data.walmartAllowPdp;

            // Generate the link URL based on the retailer and products
            originalUrl = await generateLinkUrl(
              data.selectedWebsite,
              data.selectedAction,
              data.selectedProducts || [],
              data.instacartRetailer,
              data.shoppingListData,
              data.recipeData,
              useBackupsEffective,
              allowPdpRequest
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

          documentData.shortId = shortenResult.shortId;

          const fallbackUrl =
            data.customUrl || data.redirectUrl || data.fallbackUrl;
          if (fallbackUrl) {
            documentData.customUrl = fallbackUrl;
            documentData.redirectUrl = fallbackUrl;
            documentData.fallbackUrl = fallbackUrl;
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

          documentData.useBackups = Boolean(data.useBackups);

          if (useBackupsEffective && normalizedBackupProducts) {
            documentData.backupProducts = normalizedBackupProducts;
          } else if (data.backupProducts) {
            documentData.legacyBackupProducts = data.backupProducts;
          }

          const isWalmartAddToCart =
            data.linkType === "2" &&
            data.selectedWebsite === "Walmart.com" &&
            data.selectedAction === "Add Items to Cart";

          if (isWalmartAddToCart) {
            const allowPdpFlag = deriveAllowPdpFlag(data, originalUrl);
            if (typeof allowPdpFlag === "boolean") {
              documentData.allowPdp = allowPdpFlag;
              documentData.allow_pdp = allowPdpFlag;
            }

            const cartUrlOptions = extractCartUrlOptions(data);
            const storePreferences = extractStorePreferences(data);
            Object.assign(documentData, storePreferences);

            const smartCartPayload: Record<string, any> = {};
            if (cartUrlOptions) {
              smartCartPayload.cartUrlOptions = cartUrlOptions;
            }
            if (storePreferences.storeId) {
              smartCartPayload.storeId = storePreferences.storeId;
            }
            if (storePreferences.defaultStoreId) {
              smartCartPayload.defaultStoreId = storePreferences.defaultStoreId;
            }
            if (storePreferences.preferredStoreId) {
              smartCartPayload.preferredStoreId =
                storePreferences.preferredStoreId;
            }

            if (Object.keys(smartCartPayload).length > 0) {
              documentData.smartCart = smartCartPayload;
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
