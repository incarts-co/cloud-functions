import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { createClient } from "@supabase/supabase-js";
import * as admin from "firebase-admin";

// Initialize Firebase Admin SDK
admin.initializeApp();

// Initialize Supabase client
const supabaseUrl = "https://pkhqcfcdgclksrwrpfqs.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBraHFjZmNkZ2Nsa3Nyd3JwZnFzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTk0MTkzMzgsImV4cCI6MjAzNDk5NTMzOH0.hcxzo05NPDGDSexARi2u1q2I2rkueBc6dJu44R_dVbs";
const supabase = createClient(supabaseUrl, supabaseKey);

interface ClickData {
  deviceType?: string;
  geoipData?: {
    cityName?: string;
    countryName?: string;
    location?: {
      accuracyRadius?: number;
      latitude?: number;
      longitude?: number;
      timeZone?: string;
    };
    maxmindQueriesRemaining?: number;
    postalCode?: string;
    state?: Array<{
      isoCode?: string;
      name?: string;
    }>;
  };
  ipAddress?: string;
  linkActionType?: string;
  linkSiteName?: string;
  linkTags?: string[];
  name?: string;
  pagetype?: string;
  productId?: string;
  projectDetails?: {
    projectId?: string;
    projectName?: string;
  };
  projectId?: string;
  qrCodeUrl?: string;
  referrer?: string;
  shortId?: string;
  shortLink?: string;
  siteplainname?: string;
  timestamp?: FirebaseFirestore.Timestamp;
  campaignId?: string;
  influencerId?: string;
  linkType?: string;
}

interface LinkData {
  urlShortCode?: string;
  name?: string;
  description?: string;
  linkTags?: string[];
  linkValue?: number;
  linkactiveflag?: boolean;
  pageType?: string;
  longLink?: string;
  shortLink?: string;
  shortlinkwithouthttps?: string;
  siteRetailer?: string;
  siteplainname?: string;
  qrCode?: string;
  linkqrcodeimgurl?: string;
  utmParameters?: Record<string, string>;
  productId?: string;
  projectDetails?: {
    projectId?: string;
    projectName?: string;
  };
  retailerDetails?: {
    retailerName?: string;
    retailerProductId?: string;
    retailerProductName?: string;
  };
}

interface ProductData {
  docId?: string;
  name?: string;
  productPrice?: number;
  largeImage?: string;
  brand?: string;
  category?: string;
  upc?: string;
  retailerNames?: string[];
  retailersV2?: Array<{
    UPC?: string;
    retailerItemId?: string;
    retailerPrice?: number;
    retailerSiteName?: string;
    retailerTitle?: string;
    siteName?: string;
    productPageUrl?: string;
    retailerMainImage?: string;
    walmartOfferId?: string;
  }>;
}

export const syncClickToSupabase = onDocumentWritten({
  document: "clicks/{clickId}",
  region: "us-central1",
  memory: "1GiB", 
  timeoutSeconds: 300,
  maxInstances: 10
}, async (event) => {
    const clickId = event.params.clickId;
    const newValue = event.data?.after?.data() as ClickData | undefined;

    if (!newValue) {
      console.log("Document was deleted, skipping function execution.");
      return null;
    }

    console.log("Processing click data:", JSON.stringify(newValue, null, 2));

    try {
      // Get enriched data from links and products
      const enrichedData = await getLinkAndProductData(newValue);

      // Prepare data for Supabase
      const supabaseData = prepareSupabaseData(newValue, enrichedData, clickId);

      // Upload to Supabase
      const { data, error } = await supabase
        .from("link_clicks")
        .upsert(supabaseData, { onConflict: "firestore_id" })
        .select();

      if (error) throw error;
      console.log("Data upserted in Supabase:", data);

      return null;
    } catch (error) {
      console.error("Error in cloud function:", error);
      return null;
    }
  }
);

async function getLinkAndProductData(clickData: ClickData): Promise<{
  link?: LinkData;
  product?: ProductData;
  productPrice: number;
  linkValue: number;
  utmParameters?: Record<string, string>;
}> {
  let link: LinkData | undefined;
  let product: ProductData | undefined;
  let productPrice = 0;
  let linkValue = 0;
  let utmParameters: Record<string, string> | undefined;

  // Step 1: Get link document
  if (clickData.shortId) {
    const linksSnapshot = await admin
      .firestore()
      .collection("links")
      .where("urlShortCode", "==", clickData.shortId)
      .limit(1)
      .get();

    if (!linksSnapshot.empty) {
      const linkDoc = linksSnapshot.docs[0].data() as LinkData;
      link = linkDoc;
      linkValue = linkDoc.linkValue || 0;
      utmParameters = linkDoc.utmParameters;

      // Step 2: If link has productId, get product document
      if (linkDoc.productId) {
        const productSnapshot = await admin
          .firestore()
          .collection("products")
          .doc(linkDoc.productId)
          .get();

        if (productSnapshot.exists) {
          product = productSnapshot.data() as ProductData;
          productPrice = product.productPrice || 0;
        }
      } else {
        // If no product is referenced, use link value as product price
        productPrice = linkValue;
      }
    }
  }

  return {
    link,
    product,
    productPrice,
    linkValue,
    utmParameters,
  };
}

function prepareSupabaseData(
  clickData: ClickData,
  enrichedData: {
    link?: LinkData;
    product?: ProductData;
    productPrice: number;
    linkValue: number;
    utmParameters?: Record<string, string>;
  },
  clickId: string
) {
  const { link, product, productPrice, linkValue, utmParameters } =
    enrichedData;

  // Get basic product details
  let productBrand = "";
  let productCategory = "";

  if (product) {
    // Get product basic information (not retailer-specific)
    productBrand = product.brand || "";
    productCategory = product.category || "";
  }

  // Combine data from click, link, and product
  return {
    // Existing fields from original function
    firestore_id: clickId,
    short_id: clickData.shortId,
    device_type: clickData.deviceType,
    city_name: clickData.geoipData?.cityName,
    country_name: clickData.geoipData?.countryName,
    latitude: clickData.geoipData?.location?.latitude,
    longitude: clickData.geoipData?.location?.longitude,
    time_zone: clickData.geoipData?.location?.timeZone,
    accuracy_radius: clickData.geoipData?.location?.accuracyRadius,
    maxmind_queries_remaining: clickData.geoipData?.maxmindQueriesRemaining,
    postal_code: clickData.geoipData?.postalCode,
    state_iso_code: clickData.geoipData?.state?.[0]?.isoCode,
    state_name: clickData.geoipData?.state?.[0]?.name,
    ip_address: clickData.ipAddress,
    referrer: clickData.referrer,
    timestamp: clickData.timestamp
      ? clickData.timestamp.toDate().toISOString()
      : new Date().toISOString(),
    product_price: productPrice,
    link_value: linkValue,
    campaign_id: clickData.campaignId,
    influencer_id: clickData.influencerId,
    last_updated: new Date().toISOString(),

    // Fields from link document
    link_action_type: link?.pageType || clickData.linkActionType || "Unknown",
    link_site_name: link?.siteplainname || clickData.linkSiteName || "Unknown",
    link_tags:
      link?.linkTags && Array.isArray(link.linkTags)
        ? link.linkTags.join(",")
        : Array.isArray(clickData.linkTags)
        ? clickData.linkTags.join(",")
        : null,
    name: link?.name || clickData.name || "Untitled",
    page_type: link?.pageType || clickData.pagetype || "Unknown",
    project_id:
      link?.projectDetails?.projectId ||
      clickData.projectId ||
      clickData.projectDetails?.projectId ||
      null,
    project_name:
      link?.projectDetails?.projectName ||
      clickData.projectDetails?.projectName ||
      null,
    qr_code_url:
      link?.qrCode || link?.linkqrcodeimgurl || clickData.qrCodeUrl || null,
    short_link: link?.shortLink || clickData.shortLink || null,
    site_plain_name:
      link?.siteplainname || clickData.siteplainname || "Unknown",
    utm_parameters: utmParameters || null,
    link_type: clickData.linkType || link?.pageType || null,

    // Additional product details
    product_id:
      product?.docId || link?.productId || clickData.productId || null,

    // Additional fields to be added to Supabase
    product_name: product?.name || null,
    product_brand: productBrand || null,
    product_category: productCategory || null,
    retailer_name: link?.siteRetailer || null,
  };
}

