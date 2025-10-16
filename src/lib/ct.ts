import {
  ClientBuilder,
  type AuthMiddlewareOptions,
} from '@commercetools/sdk-client-v2';
import { createApiBuilderFromCtpClient } from '@commercetools/platform-sdk';

export const ct = (() => {
  const client = new ClientBuilder()
    .withClientCredentialsFlow({
      host: process.env.CTP_AUTH_URL!,
      projectKey: process.env.CTP_PROJECT_KEY!,
      credentials: {
        clientId: process.env.CTP_CLIENT_ID!,
        clientSecret: process.env.CTP_CLIENT_SECRET!,
      },
    })
    .withHttpMiddleware({ host: process.env.CTP_API_URL! })
    .withLoggerMiddleware()
    .build();

  return createApiBuilderFromCtpClient(client)
    .withProjectKey({ projectKey: process.env.CTP_PROJECT_KEY! });
})();

export async function getCandidateProducts(limit = 50) {
  try {
    const res = await ct.products().get({
      queryArgs: {
        limit,
        expand: ['masterData.current.categories[*]', 'masterData.current.masterVariant.images[*]']
      }
    }).execute();
    return res.body.results;
  } catch (error) {
    console.error('Error fetching products:', error);
    return [];
  }
}

export async function saveCampaignPlan(id: string, payload: any) {
  try {
    return await ct.customObjects().post({
      body: {
        container: 'ai-campaigns',
        key: id,
        value: payload,
      }
    }).execute();
  } catch (error) {
    console.error('Error saving campaign plan:', error);
    throw error;
  }
}

export async function getCampaignPlan(id: string) {
  try {
    const res = await ct.customObjects()
      .withContainerAndKey({ container: 'ai-campaigns', key: id })
      .get()
      .execute();
    return res.body.value;
  } catch (error) {
    console.error('Error fetching campaign plan:', error);
    return null;
  }
}

// Bundle Product Type Management
const BUNDLE_PRODUCT_TYPE_KEY = 'ai-bundle-product-type';
const BUNDLE_PRODUCT_TYPE_NAME = 'AI Bundle Product';

// Tax Category Management
const STANDARD_TAX_CATEGORY_KEY = 'standard-tax-category';
const STANDARD_TAX_CATEGORY_NAME = 'Standard Tax';

export async function ensureBundleProductType() {
  console.log(`🔍 CT: Checking if bundle product type exists...`);

  try {
    // Try to get existing bundle product type
    try {
      const existingProductType = await ct.productTypes()
        .withKey({ key: BUNDLE_PRODUCT_TYPE_KEY })
        .get()
        .execute();

      console.log(`✅ CT: Bundle product type already exists: ${existingProductType.body.id}`);
      return existingProductType.body;
    } catch (notFoundError) {
      // Product type doesn't exist, create it
      console.log(`🆕 CT: Creating bundle product type...`);

      const productTypeResponse = await ct.productTypes()
        .post({
          body: {
            key: BUNDLE_PRODUCT_TYPE_KEY,
            name: BUNDLE_PRODUCT_TYPE_NAME,
            description: 'Product type for AI-generated bundle products',
            attributes: [
              {
                name: 'bundleSkus',
                label: { en: 'Bundle SKUs' },
                type: { name: 'set', elementType: { name: 'text' } },
                attributeConstraint: 'None',
                inputHint: 'MultiLine',
                isSearchable: true,
                isRequired: false
              },
              {
                name: 'discountPercent',
                label: { en: 'Discount Percentage' },
                type: { name: 'number' },
                attributeConstraint: 'None',
                inputHint: 'SingleLine',
                isSearchable: true,
                isRequired: false
              },
              {
                name: 'campaignTheme',
                label: { en: 'Campaign Theme' },
                type: { name: 'text' },
                attributeConstraint: 'None',
                inputHint: 'SingleLine',
                isSearchable: true,
                isRequired: false
              },
              {
                name: 'aiGenerated',
                label: { en: 'AI Generated' },
                type: { name: 'boolean' },
                attributeConstraint: 'None',
                isSearchable: true,
                isRequired: false
              }
            ]
          }
        })
        .execute();

      console.log(`✅ CT: Bundle product type created: ${productTypeResponse.body.id}`);
      return productTypeResponse.body;
    }
  } catch (error) {
    console.error('❌ CT: Error ensuring bundle product type:', error);
    throw error;
  }
}

export async function ensureStandardTaxCategory() {
  console.log(`🔍 CT: Checking if standard tax category exists...`);

  try {
    // Try to get existing tax category
    try {
      const existingTaxCategory = await ct.taxCategories()
        .withKey({ key: STANDARD_TAX_CATEGORY_KEY })
        .get()
        .execute();

      console.log(`✅ CT: Standard tax category already exists: ${existingTaxCategory.body.id}`);
      return existingTaxCategory.body;
    } catch (notFoundError) {
      // Tax category doesn't exist, create it
      console.log(`🆕 CT: Creating standard tax category...`);

      const taxCategoryResponse = await ct.taxCategories()
        .post({
          body: {
            key: STANDARD_TAX_CATEGORY_KEY,
            name: STANDARD_TAX_CATEGORY_NAME,
            description: 'Standard tax category for AI-generated bundle products',
            rates: [
              {
                name: 'Standard Rate',
                amount: 0.20, // 20% tax rate - adjust as needed
                includedInPrice: false,
                country: 'US',
                state: 'NY' // You can adjust the state/country as needed
              }
            ]
          }
        })
        .execute();

      console.log(`✅ CT: Standard tax category created: ${taxCategoryResponse.body.id}`);
      return taxCategoryResponse.body;
    }
  } catch (error) {
    console.error('❌ CT: Error ensuring standard tax category:', error);
    throw error;
  }
}

export async function createBundleProduct(bundle: any, productType: any, taxCategory: any, campaignTheme: string) {
  // Ensure bundle has a proper name
  const bundleName = bundle.name || `${campaignTheme} Bundle ${Date.now()}`;
  const bundleDescription = bundle.emailBlurb || `AI-generated bundle for ${campaignTheme} campaign`;

  console.log(`🛍️ CT: Creating bundle product: ${bundleName}`);

  try {
    // Helper function to convert relative URLs to absolute URLs and validate them
    const getAbsoluteImageUrl = (imageUrl: string): string => {
      if (!imageUrl || typeof imageUrl !== 'string') {
        console.warn(`⚠️ CT: Invalid image URL: ${imageUrl}`);
        return '';
      }

      // Remove any control characters or invalid characters from URL
      const sanitizedUrl = imageUrl
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, '') // Remove control characters
        .trim();

      if (sanitizedUrl.startsWith('http://') || sanitizedUrl.startsWith('https://')) {
        // Validate the URL format
        try {
          const url = new URL(sanitizedUrl);
          console.log(`✅ CT: Valid absolute URL: ${url.href}`);
          return url.href; // Return the validated URL
        } catch (urlError) {
          console.warn(`⚠️ CT: Invalid URL format: ${sanitizedUrl}`, urlError);
          return '';
        }
      }

      // Convert relative URL to absolute using deployed domain
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://ecomhack25-anton.vercel.app';
      const fullUrl = `${baseUrl}${sanitizedUrl}`;

      try {
        const url = new URL(fullUrl);
        console.log(`✅ CT: Converted to absolute URL: ${url.href}`);
        return url.href;
      } catch (urlError) {
        console.warn(`⚠️ CT: Failed to create absolute URL: ${fullUrl}`, urlError);
        return '';
      }
    };

    // Debug: Log bundle data before processing images
    console.log(`🔍 CT: Bundle data for "${bundleName}":`, {
      bundleImageUrl: bundle.bundleImageUrl,
      bundleImageUrlType: typeof bundle.bundleImageUrl,
      childProductImages: bundle.childProductImages,
      childProductImagesLength: bundle.childProductImages?.length || 0,
      hasImages: !!(bundle.bundleImageUrl || (bundle.childProductImages && bundle.childProductImages.length > 0))
    });

    // Log all bundle properties to debug what's being passed
    console.log(`🔍 CT: All bundle properties for "${bundleName}":`, Object.keys(bundle));

    // Prepare images for the bundle product
    const images = [];
    if (bundle.bundleImageUrl) {
      const absoluteImageUrl = getAbsoluteImageUrl(bundle.bundleImageUrl);
      if (absoluteImageUrl) {
        console.log(`🖼️ CT: Adding bundle image to product: ${absoluteImageUrl}`);
        images.push({
          url: absoluteImageUrl,
          label: `${bundleName} - Bundle Image`,
          dimensions: {
            w: 800,
            h: 600
          }
        });
      } else {
        console.warn(`⚠️ CT: Skipping invalid bundle image URL for "${bundleName}"`);
      }
    } else {
      console.warn(`⚠️ CT: No bundle image URL found for bundle "${bundleName}"`);
    }

    // Add child product images as additional images
    if (bundle.childProductImages && bundle.childProductImages.length > 0) {
      console.log(`📸 CT: Processing ${bundle.childProductImages.length} child product images`);
      bundle.childProductImages.forEach((imageUrl: string, index: number) => {
        const absoluteImageUrl = getAbsoluteImageUrl(imageUrl);
        if (absoluteImageUrl) {
          console.log(`  - Child image ${index + 1}: ${absoluteImageUrl}`);
          images.push({
            url: absoluteImageUrl,
            label: `${bundleName} - Product ${index + 1}`,
            dimensions: {
              w: 600,
              h: 400
            }
          });
        } else {
          console.warn(`  - Skipping invalid child image ${index + 1}: ${imageUrl}`);
        }
      });
    } else {
      console.warn(`⚠️ CT: No child product images found for bundle "${bundleName}"`);
    }

    console.log(`📊 CT: Total images prepared for "${bundleName}": ${images.length}`);

    // Generate a clean slug from the bundle name
    const cleanSlug = bundleName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

    // Sanitize text fields to prevent JSON validation errors
    const sanitizeText = (text: string): string => {
      return text
        .replace(/[\u0000-\u001f\u007f-\u009f]/g, '') // Remove control characters
        .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '') // Keep only printable characters
        .trim();
    };

    const sanitizedBundleName = sanitizeText(bundleName);
    const sanitizedBundleDescription = sanitizeText(bundleDescription);
    const sanitizedSlug = cleanSlug || `bundle-${Date.now()}`;

    // Prepare the request payload
    const requestPayload = {
      key: `bundle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      productType: {
        typeId: 'product-type' as const,
        id: productType.id
      },
      taxCategory: {
        typeId: 'tax-category' as const,
        id: taxCategory.id
      },
      name: {
        en: sanitizedBundleName,
        'en-US': sanitizedBundleName,
        'en-GB': sanitizedBundleName
      },
      description: {
        en: sanitizedBundleDescription,
        'en-US': sanitizedBundleDescription,
        'en-GB': sanitizedBundleDescription
      },
      slug: {
        en: sanitizedSlug,
        'en-US': sanitizedSlug,
        'en-GB': sanitizedSlug
      },
      masterVariant: {
        sku: `bundle-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        prices: [{
          value: {
            currencyCode: 'USD',
            centAmount: typeof bundle.targetPrice === 'number' && bundle.targetPrice > 0 ? Math.round(bundle.targetPrice) : 1000
          }
        }],
        images: images.length > 0 ? images : undefined,
        attributes: [
          {
            name: 'bundleSkus',
            value: Array.isArray(bundle.skus) ? bundle.skus.filter((sku: any) => sku && typeof sku === 'string') : []
          },
          {
            name: 'discountPercent',
            value: typeof bundle.discountPercent === 'number' ? bundle.discountPercent : 0
          },
          {
            name: 'campaignTheme',
            value: sanitizeText(campaignTheme)
          },
          {
            name: 'aiGenerated',
            value: true
          }
        ]
      }
    };

    // Log the complete payload for debugging
    console.log(`🔍 CT: Complete request payload for "${sanitizedBundleName}":`, JSON.stringify(requestPayload, null, 2));

    // Validate JSON serialization before sending
    try {
      JSON.stringify(requestPayload);
      console.log(`✅ CT: JSON validation passed for "${sanitizedBundleName}"`);
    } catch (jsonError) {
      console.error(`❌ CT: JSON validation failed for "${sanitizedBundleName}":`, jsonError);
      throw new Error(`Invalid JSON payload: ${jsonError}`);
    }

    const productResponse = await ct.products()
      .post({
        body: requestPayload
      })
      .execute();

    console.log(`✅ CT: Bundle product created: ${productResponse.body.id}`);
    return productResponse.body;
  } catch (error) {
    console.error(`❌ CT: Error creating bundle product ${bundleName}:`, error);
    throw error;
  }
}

export async function createBundleProducts(bundles: any[], campaignTheme: string) {
  console.log(`🎯 CT: Creating ${bundles.length} bundle products for campaign: ${campaignTheme}`);

  try {
    // Ensure bundle product type exists
    const productType = await ensureBundleProductType();

    // Ensure standard tax category exists
    const taxCategory = await ensureStandardTaxCategory();

    // Create bundle products
    const createdProducts = [];

    for (const bundle of bundles) {
      try {
        const product = await createBundleProduct(bundle, productType, taxCategory, campaignTheme);
        createdProducts.push({
          ...bundle,
          productId: product.id,
          productKey: product.key,
          sku: product.masterData.current.masterVariant.sku,
          slug: product.masterData.current.slug?.en,
          productImages: product.masterData.current.masterVariant.images || []
        });
      } catch (error) {
        const bundleName = bundle.name || `${campaignTheme} Bundle`;
        console.error(`⚠️ CT: Failed to create bundle product ${bundleName}, skipping:`, error);
        // Continue with other bundles even if one fails
        createdProducts.push({
          ...bundle,
          name: bundleName, // Ensure name is preserved
          error: 'Failed to create in commercetools'
        });
      }
    }

    console.log(`✅ CT: Bundle products creation completed. ${createdProducts.filter(p => p.productId).length}/${bundles.length} successful`);

    return {
      success: true,
      totalBundles: bundles.length,
      successfulProducts: createdProducts.filter(p => p.productId).length,
      failedProducts: createdProducts.filter(p => !p.productId).length,
      products: createdProducts,
      productType: {
        id: productType.id,
        key: productType.key,
        name: productType.name
      }
    };
  } catch (error) {
    console.error('❌ CT: Error in bundle products creation:', error);
    throw error;
  }
}

// Cart Discount and Discount Code Management
export async function createBundleCartDiscount(bundle: any, campaignTheme: string) {
  console.log(`🎫 CT: Creating cart discount for bundle: ${bundle.name}`);

  try {
    // Create a cart discount that applies when specific SKUs are in cart
    const cartDiscountResponse = await ct.cartDiscounts()
      .post({
        body: {
          key: `bundle-discount-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: { en: `${bundle.name} Bundle Discount` },
          description: { en: `Auto-discount for ${bundle.name} bundle in ${campaignTheme} campaign` },
          value: {
            type: 'absolute',
            money: [{
              currencyCode: 'USD',
              centAmount: Math.round((bundle.originalPrice - bundle.targetPrice))
            }]
          },
          cartPredicate: `lineItems(sku in ("${bundle.skus.join('", "')}")) and lineItems(sku in ("${bundle.skus.join('", "')}")).count() = ${bundle.skus.length}`,
          target: {
            type: 'lineItems',
            predicate: `sku in ("${bundle.skus.join('", "')}")`
          },
          isActive: true,
          requiresDiscountCode: true,
          sortOrder: '0.9'
        }
      })
      .execute();

    console.log(`✅ CT: Cart discount created: ${cartDiscountResponse.body.id}`);
    return cartDiscountResponse.body;
  } catch (error) {
    console.error(`❌ CT: Error creating cart discount for ${bundle.name}:`, error);
    throw error;
  }
}

export async function createBundleDiscountCode(bundle: any, cartDiscountId: string, campaignTheme: string) {
  console.log(`🔑 CT: Creating discount code for bundle: ${bundle.name}`);

  try {
    // Generate a unique discount code
    const discountCode = `${campaignTheme.replace(/\s+/g, '').toUpperCase()}-${bundle.name.replace(/\s+/g, '').toUpperCase()}-${Date.now().toString().slice(-4)}`;

    const discountCodeResponse = await ct.discountCodes()
      .post({
        body: {
          key: `bundle-code-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: { en: `${bundle.name} Bundle Code` },
          description: { en: `Discount code for ${bundle.name} bundle` },
          code: discountCode,
          cartDiscounts: [{
            typeId: 'cart-discount',
            id: cartDiscountId
          }],
          isActive: true,
          maxApplicationsPerCustomer: 1,
          maxApplications: 1000 // Limit total uses
        }
      })
      .execute();

    console.log(`✅ CT: Discount code created: ${discountCode} (${discountCodeResponse.body.id})`);
    return {
      ...discountCodeResponse.body,
      code: discountCode
    };
  } catch (error) {
    console.error(`❌ CT: Error creating discount code for ${bundle.name}:`, error);
    throw error;
  }
}

export async function createBundleDiscountsAndCodes(bundles: any[], campaignTheme: string) {
  console.log(`🎯 CT: Creating discounts and codes for ${bundles.length} bundles in ${campaignTheme} campaign`);

  try {
    const bundleDiscounts = [];

    for (const bundle of bundles) {
      try {
        // Calculate original price from individual SKUs
        const originalPrice = bundle.skus.reduce((total: number, sku: string) => {
          // In a real implementation, you'd fetch actual product prices
          // For now, we'll estimate based on target price and discount
          const estimatedOriginalPrice = Math.round(bundle.targetPrice / (1 - bundle.discountPercent / 100));
          return total + (estimatedOriginalPrice / bundle.skus.length);
        }, 0);

        const bundleWithPricing = {
          ...bundle,
          originalPrice
        };

        // Create cart discount
        const cartDiscount = await createBundleCartDiscount(bundleWithPricing, campaignTheme);

        // Create discount code
        const discountCode = await createBundleDiscountCode(bundleWithPricing, cartDiscount.id, campaignTheme);

        bundleDiscounts.push({
          ...bundleWithPricing,
          cartDiscountId: cartDiscount.id,
          discountCodeId: discountCode.id,
          discountCode: discountCode.code,
          checkoutUrl: generateCheckoutUrl(bundle.skus, discountCode.code)
        });

        console.log(`✅ CT: Bundle discount setup complete for ${bundle.name}: ${discountCode.code}`);
      } catch (error) {
        console.error(`⚠️ CT: Failed to create discount for bundle ${bundle.name}:`, error);
        bundleDiscounts.push({
          ...bundle,
          error: 'Failed to create discount code'
        });
      }
    }

    console.log(`✅ CT: Bundle discounts creation completed. ${bundleDiscounts.filter(b => b.discountCode).length}/${bundles.length} successful`);

    return {
      success: true,
      totalBundles: bundles.length,
      successfulDiscounts: bundleDiscounts.filter(b => b.discountCode).length,
      failedDiscounts: bundleDiscounts.filter(b => !b.discountCode).length,
      bundleDiscounts
    };
  } catch (error) {
    console.error('❌ CT: Error in bundle discounts creation:', error);
    throw error;
  }
}

function generateCheckoutUrl(skus: string[], discountCode: string): string {
  // Generate checkout URL that adds all SKUs to cart with discount code
  const baseUrl = process.env.NEXT_PUBLIC_CHECKOUT_URL || 'https://your-storefront.com/checkout';
  const skuParams = skus.map(sku => `sku=${encodeURIComponent(sku)}`).join('&');
  return `${baseUrl}?${skuParams}&discount=${encodeURIComponent(discountCode)}&bundle=true`;
}