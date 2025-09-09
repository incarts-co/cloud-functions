/**
 * @fileoverview Syncs click data from Firestore to Supabase for analytics
 * @description This Cloud Function monitors the Firestore 'clicks' collection and enriches
 * click data with link and product information before syncing to Supabase's link_clicks table.
 * Now includes QR code tracking to differentiate between QR scans and direct link clicks.
 * @module write-clicks-to-supabase
 * @related
 * - generate-link-http: Creates links and QR codes
 * - Supabase link_clicks table: Analytics data storage
 * - Firestore collections: clicks, links, products, qrCodes
 */

import {onDocumentWritten} from "firebase-functions/v2/firestore";
import {createClient} from "@supabase/supabase-js";
import * as admin from "firebase-admin";
import {logger} from "firebase-functions";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Initialize Supabase client
const supabaseUrl = "https://pkhqcfcdgclksrwrpfqs.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraHFjZmNkZ2Nsa3Nyd3JwZnFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTk0MTkzMzgsImV4cCI6MjAzNDk5NTMzOH0.hcxzo05NPDGDSexARi2u1q2I2rkueBc6dJu44R_dVbs";
const supabase = createClient(supabaseUrl, supabaseKey);

interface GeoLocation {
  accuracyRadius?: number;
  latitude?: number;
  longitude?: number;
  timeZone?: string;
}


interface GeoIpData {
  // Lowercase field names
  city?: string;
  country?: string;
  location?: GeoLocation;
  maxmindQueriesRemaining?: number;
  postal?: string;
  region?: string;
  source?: string;
  // CamelCase field names (alternative naming)
  cityName?: string;
  countryName?: string;
  postalCode?: string;
  // State can be an array of objects or null
  state?: Array<{
    isoCode: string;
    name: string;
  }> | null;
}

interface ClickProjectDetails {
  projectId?: string;
  projectName?: string;
}

// Interface for the data structure in the 'clicks' collection in Firestore
interface ClickData {
  deviceType?: string;
  geoipData?: GeoIpData;
  ipAddress?: string;
  linkActionType?: string; // This might be redundant if LinkData.pageType is preferred
  linkSiteName?: string; // This might be redundant if LinkData.siteplainname is preferred
  linkTags?: string[]; // From the click event itself, if different from the link's tags
  name?: string; // Name associated with the click event, potentially overriding link name
  pagetype?: string; // Similar to linkActionType, consider standardizing
  productId?: string; // Product ID directly associated with the click event
  projectDetails?: ClickProjectDetails; // Project details from click
  projectId?: string; // Fallback projectId on click
  qrCodeUrl?: string; // QR code URL if the click came from a QR code not defined on the link
  referrer?: string;
  shortId?: string; // This is the urlShortCode of the link that was clicked
  shortLink?: string; // The shortLink URL that was clicked
  siteplainname?: string; // Retailer/site name if specific to this click context
  timestamp?: admin.firestore.Timestamp;
  campaignId?: string;
  campaign_name?: string; // If you capture campaign name directly on click
  influencerId?: string;
  linkType?: string; // Type of link/interaction as recorded by the click
  userAgent?: string; // User agent string
  // QR Code tracking fields
  sourceType?: string; // 'qr' or 'link' - indicates click source
  qrIdentifier?: string; // QR code identifier (e.g., "black-friday-2025")
  qrCodeId?: string; // Document ID from qrCodes collection
  // Any other fields you have directly on the click document
}

// Interface for the data structure in the 'links' collection in Firestore
interface LinkData {
  docId?: string; // Firestore document ID of this link
  urlShortCode?: string;
  name?: string;
  description?: string;
  linkTags?: string[];
  linkValue?: number;
  linkactiveflag?: boolean;
  pageType?: string; // Primary type of the link (e.g., ATC, Shoppable, Link)
  longLink?: string;
  shortLink?: string;
  created?: {
    // Assuming 'created' is an object with a timestamp and userId
    timestamp?: admin.firestore.Timestamp;
    userId?: string;
  };
  siteRetailer?: string; // Specific retailer for this link
  siteplainname?: string; // General site/platform name for this link
  qrCode?: string;
  linkqrcodeimgurl?: string; // Alternative QR code URL
  utmParameters?: Record<string, string>;
  productId?: string; // Product ID associated with this link
  projectDetails?: {
    projectId?: string;
    projectName?: string;
  };
  // retailerDetails might be too nested for easy staging, consider flattening if needed
}

// Interface for the data structure in the 'products' collection in Firestore
interface ProductData {
  docId?: string; // Firestore document ID of this product
  name?: string;
  productPrice?: number;
  brand?: string;
  category?: string;
  upc?: string;
  // other product fields as needed
}

/**
 * Cloud Function that syncs click data to Supabase when a click document is created or updated
 * @function syncClickToSupabase
 * @description Triggers on Firestore clicks collection changes, enriches the data with link/product info,
 * and syncs to Supabase for analytics. Supports QR code tracking to differentiate click sources.
 */
export const syncClickToSupabase = onDocumentWritten(
  {
    document: "clicks/{clickId}", // Path to your clicks collection
    region: "us-central1", // Or your preferred region
    memory: "1GiB",
    timeoutSeconds: 300,
    maxInstances: 10,
  },
  async (event) => {
    const firestoreClickId = event.params.clickId; // Firestore document ID of the click
    const clickSnapshot = event.data?.after;

    if (!clickSnapshot || !clickSnapshot.exists) {
      logger.log(
        "Click document was deleted or does not exist, skipping.",
        firestoreClickId
      );
      return null;
    }

    const clickData = clickSnapshot.data() as ClickData;
    logger.log(
      "Processing click data for Firestore ID:",
      firestoreClickId,
      JSON.stringify(clickData, null, 2)
    );

    try {
      const enrichedData = await getLinkAndProductData(
        clickData,
        firestoreClickId
      );
      const supabaseData = prepareSupabaseData(
        clickData,
        enrichedData,
        firestoreClickId
      );

      logger.log(
        "Prepared Supabase data:",
        JSON.stringify(supabaseData, null, 2)
      );

      const {data, error} = await supabase
        .from("link_clicks") // Your staging table name in Supabase
        .upsert(supabaseData, {onConflict: "firestore_id"}) // Assuming 'firestore_id' is unique in Supabase
        .select();

      if (error) {
        logger.error(
          "Supabase upsert error for click ID:",
          firestoreClickId,
          error
        );
        throw error; // Rethrow to trigger retries if configured, or for monitoring
      }
      logger.log(
        "Data upserted in Supabase for click ID:",
        firestoreClickId,
        data
      );
      return null;
    } catch (error) {
      logger.error(
        "Error in syncClickToSupabase for click ID:",
        firestoreClickId,
        error
      );
      // Depending on your error handling strategy, you might want to:
      // - Write to a dead-letter queue in Firestore/PubSub
      // - Simply log and allow the function to terminate
      return null; // Or rethrow if you want Firebase to retry (be mindful of infinite loops)
    }
  }
);

/**
 * Fetches and enriches click data with link and product information from Firestore
 * @async
 * @function getLinkAndProductData
 * @param {ClickData} clickData - The click data from Firestore
 * @param {string} firestoreClickId - The Firestore document ID for logging
 * @return {Promise<Object>} Enriched data containing link, product, prices, and UTM parameters
 */
async function getLinkAndProductData(
  clickData: ClickData,
  firestoreClickId: string // For logging
): Promise<{
  link?: LinkData & { firestoreDocId?: string }; // Add Firestore doc ID to link
  product?: ProductData;
  productPrice: number;
  linkValue: number;
  linkUtmParameters?: Record<string, string>;
}> {
  let link: (LinkData & { firestoreDocId?: string }) | undefined;
  let product: ProductData | undefined;
  let productPrice = 0;
  let linkValue = 0;
  let linkUtmParameters: Record<string, string> | undefined;

  if (!clickData.shortId) {
    logger.warn(
      "Click data is missing shortId, cannot enrich link/product info.",
      firestoreClickId
    );
    return {productPrice, linkValue};
  }

  try {
    const linksSnapshot = await admin
      .firestore()
      .collection("links") // Your links collection name
      .where("urlShortCode", "==", clickData.shortId)
      .limit(1)
      .get();

    if (!linksSnapshot.empty) {
      const linkDocSnapshot = linksSnapshot.docs[0];
      const linkDataFromFirestore = linkDocSnapshot.data() as LinkData;
      link = {...linkDataFromFirestore, firestoreDocId: linkDocSnapshot.id}; // Include Firestore doc ID

      linkValue = link.linkValue || 0;
      linkUtmParameters = link.utmParameters;

      if (link.productId) {
        const productSnapshot = await admin
          .firestore()
          .collection("products") // Your products collection name
          .doc(link.productId)
          .get();

        if (productSnapshot.exists) {
          product = productSnapshot.data() as ProductData;
          // Ensure docId is part of the product object if not already
          if (!product.docId) product.docId = productSnapshot.id;
          productPrice = product.productPrice || 0;
        } else {
          logger.warn(
            `Product with ID ${link.productId} not found for link ${link.firestoreDocId}.`,
            firestoreClickId
          );
          productPrice = linkValue; // Fallback as per original logic
        }
      } else {
        productPrice = linkValue; // If no product referenced on link, use link value
      }
    } else {
      logger.warn(
        `Link with shortId (urlShortCode) ${clickData.shortId} not found.`,
        firestoreClickId
      );
    }
  } catch (error) {
    logger.error(
      `Error fetching link/product data for shortId ${clickData.shortId}:`,
      error,
      firestoreClickId
    );
    // Return default values or rethrow if critical
  }

  return {
    link,
    product,
    productPrice,
    linkValue,
    linkUtmParameters, // Renamed for clarity
  };
}

/**
 * Prepares click data for insertion into Supabase by flattening nested structures
 * and consolidating fields from multiple sources
 * @function prepareSupabaseData
 * @param {ClickData} clickData - Raw click data from Firestore
 * @param {Object} enrichedData - Enriched data containing link and product information
 * @param {string} firestoreClickId - Firestore document ID of the click
 * @return {Object} Flattened data object ready for Supabase insertion with QR tracking fields
 */
function prepareSupabaseData(
  clickData: ClickData,
  enrichedData: {
    link?: LinkData & { firestoreDocId?: string };
    product?: ProductData;
    productPrice: number;
    linkValue: number;
    linkUtmParameters?: Record<string, string>;
  },
  firestoreClickId: string // Firestore document ID of the click
) {
  const {link, product, productPrice, linkValue, linkUtmParameters} =
    enrichedData;

  // --- Consolidate and Coalesce Fields ---
  const finalName = link?.name || clickData.name || "Untitled";
  const finalProjectId =
    link?.projectDetails?.projectId ||
    clickData.projectId ||
    clickData.projectDetails?.projectId;
  const finalProjectName =
    link?.projectDetails?.projectName || clickData.projectDetails?.projectName;

  // Standardize link_type / page_type. Prefer link.pageType as the primary source for the link's nature.
  // clickData.linkType or clickData.pagetype can be secondary or represent the click interaction type.
  const finalLinkType =
    link?.pageType || clickData.linkType || clickData.pagetype || "Unknown";

  // For campaign name, prioritize click's direct campaign_name, then link's UTM, then click's UTM campaign
  const campaignNameFromClick = clickData.campaign_name;
  const campaignNameFromLinkUtm =
    linkUtmParameters?.campaign || linkUtmParameters?.utm_campaign;
  // utm_parameters on clickData itself (if you were to add it to ClickData interface)
  // const campaignNameFromClickUtm = (clickData.utm_parameters as Record<string, string> | undefined)?.campaign || (clickData.utm_parameters as Record<string, string> | undefined)?.utm_campaign;
  const finalCampaignName = campaignNameFromClick || campaignNameFromLinkUtm; // Or more complex coalescing

  const linkTagsString =
    link?.linkTags && Array.isArray(link.linkTags) ?
      link.linkTags.join(",") :
      Array.isArray(clickData.linkTags) ?
        clickData.linkTags.join(",") :
        null;

  return {
    // --- Core Click Identifiers & Timestamps ---
    firestore_id: firestoreClickId, // Primary key for upsert
    short_id: clickData.shortId, // Link identifier that was clicked
    timestamp: clickData.timestamp ?
      clickData.timestamp.toDate().toISOString() :
      new Date().toISOString(),
    last_updated: new Date().toISOString(), // Always set to now for the Supabase record update time

    // --- Click Context ---
    device_type: clickData.deviceType,
    user_agent: clickData.userAgent, // NEW
    ip_address: clickData.ipAddress,
    referrer: clickData.referrer,
    influencer_id: clickData.influencerId,

    // --- QR Code Tracking (NEW) ---
    source_type: clickData.sourceType || "link", // Default to 'link' for backward compatibility
    qr_identifier: clickData.qrIdentifier || null, // QR code identifier if this was a QR scan
    qr_code_id: clickData.qrCodeId || null, // Document ID from qrCodes collection

    // --- GeoIP Data (flattened) ---
    // Coalesce both naming patterns (camelCase and lowercase)
    city_name: clickData.geoipData?.cityName || clickData.geoipData?.city,
    country_name: clickData.geoipData?.countryName || 
      clickData.geoipData?.country,
    latitude: clickData.geoipData?.location?.latitude,
    longitude: clickData.geoipData?.location?.longitude,
    time_zone: clickData.geoipData?.location?.timeZone,
    accuracy_radius: clickData.geoipData?.location?.accuracyRadius,
    maxmind_queries_remaining: clickData.geoipData?.maxmindQueriesRemaining,
    postal_code: clickData.geoipData?.postalCode || 
      clickData.geoipData?.postal,
    // Handle complex state structure - extract from array if present
    state_iso_code: Array.isArray(clickData.geoipData?.state) && 
      clickData.geoipData.state[0]?.isoCode || null,
    state_name: Array.isArray(clickData.geoipData?.state) && 
      clickData.geoipData.state[0]?.name || 
      clickData.geoipData?.region, // Fallback to region if state array not present

    // --- Link Information (from enrichedData.link or clickData as fallback) ---
    name: finalName, // Consolidated name
    short_link: link?.shortLink || clickData.shortLink,
    link_long_url: link?.longLink, // NEW
    link_type: finalLinkType, // Standardized link type
    page_type: finalLinkType, // Often used interchangeably, ensure consistency or pick one for staging
    link_action_type: finalLinkType, // Consolidate these type fields
    link_site_name:
      link?.siteplainname || clickData.linkSiteName || clickData.siteplainname, // Coalesce
    site_plain_name:
      link?.siteplainname || clickData.siteplainname || clickData.linkSiteName, // Coalesce
    link_tags: linkTagsString,
    qr_code_url: link?.qrCode || link?.linkqrcodeimgurl || clickData.qrCodeUrl,
    link_created_at: link?.created?.timestamp?.toDate()?.toISOString(), // NEW
    link_created_by_user_id: link?.created?.userId, // NEW
    link_active_flag: link?.linkactiveflag, // NEW
    link_firestore_doc_id: link?.firestoreDocId, // NEW

    // --- Project Information ---
    project_id: finalProjectId,
    project_name: finalProjectName,

    // --- Campaign Information ---
    campaign_id: clickData.campaignId, // Primarily from click data
    campaign_name: finalCampaignName, // From click or link UTM
    campaign_name_from_link: campaignNameFromLinkUtm, // NEW - specifically from link's UTM

    // --- UTM Parameters (store as JSONB in Supabase if possible) ---
    utm_parameters: linkUtmParameters || null, // Primarily from LinkData

    // --- Product & Value Information ---
    product_id: product?.docId || link?.productId || clickData.productId,
    product_name: product?.name,
    product_brand: product?.brand,
    product_category: product?.category,
    product_upc: product?.upc, // NEW
    retailer_name: link?.siteRetailer, // From LinkData.siteRetailer
    product_price: productPrice, // Calculated (product's price or link's value)
    link_value: linkValue, // Original link_value from LinkData

    // etl_processed_at will be NULL initially, updated by the ETL process
    etl_processed_at: null,
  };
}
