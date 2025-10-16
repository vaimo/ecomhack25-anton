import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

export interface CheckoutSession {
  id: string;
  url: string;
  bundle: any;
  discountCode: string;
}

export async function createBundleCheckoutSession(
  bundle: any,
  discountCode: string,
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutSession> {
  console.log(`💳 Stripe: Creating checkout session for bundle: ${bundle.name}`);

  try {
    // Create line items for each SKU in the bundle
    const lineItems = bundle.skus.map((sku: string, index: number) => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${bundle.name} - Item ${index + 1}`,
          description: `Part of ${bundle.name} bundle`,
          metadata: {
            sku: sku,
            bundleName: bundle.name,
            discountCode: discountCode
          }
        },
        unit_amount: Math.round(bundle.targetPrice / bundle.skus.length), // Distribute price evenly
      },
      quantity: 1,
    }));

    // Create discount coupon for the bundle
    const coupon = await stripe.coupons.create({
      name: `${bundle.name} Bundle Discount`,
      percent_off: bundle.discountPercent,
      duration: 'once',
      max_redemptions: 1000,
      metadata: {
        bundleName: bundle.name,
        discountCode: discountCode,
        campaignTheme: bundle.campaignTheme || 'AI Generated Campaign'
      }
    });

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}&bundle_name=${encodeURIComponent(bundle.name)}&discount_code=${encodeURIComponent(discountCode)}`,
      cancel_url: `${cancelUrl}?bundle_name=${encodeURIComponent(bundle.name)}`,
      discounts: [{
        coupon: coupon.id,
      }],
      metadata: {
        bundleName: bundle.name,
        discountCode: discountCode,
        skus: bundle.skus.join(','),
        originalPrice: bundle.originalPrice?.toString() || '0',
        targetPrice: bundle.targetPrice.toString(),
        discountPercent: bundle.discountPercent.toString()
      },
      shipping_address_collection: {
        allowed_countries: ['US', 'CA', 'GB', 'AU', 'DE', 'FR'], // Add countries as needed
      },
      allow_promotion_codes: true, // Allow additional promo codes
    });

    console.log(`✅ Stripe: Checkout session created: ${session.id}`);
    return {
      id: session.id,
      url: session.url!,
      bundle,
      discountCode
    };
  } catch (error) {
    console.error(`❌ Stripe: Error creating checkout session for ${bundle.name}:`, error);
    throw error;
  }
}

export async function createMultipleBundleCheckouts(
  bundles: any[],
  successUrl: string,
  cancelUrl: string
): Promise<CheckoutSession[]> {
  console.log(`🛒 Stripe: Creating checkout sessions for ${bundles.length} bundles`);

  const checkoutSessions = [];

  for (const bundle of bundles) {
    try {
      if (bundle.discountCode) {
        const session = await createBundleCheckoutSession(bundle, bundle.discountCode, successUrl, cancelUrl);
        checkoutSessions.push(session);
      } else {
        console.warn(`⚠️ Stripe: Skipping bundle ${bundle.name} - no discount code available`);
        checkoutSessions.push({
          id: 'error',
          url: '',
          bundle,
          discountCode: '',
          error: 'No discount code available'
        });
      }
    } catch (error) {
      console.error(`⚠️ Stripe: Failed to create checkout for bundle ${bundle.name}:`, error);
      checkoutSessions.push({
        id: 'error',
        url: '',
        bundle,
        discountCode: bundle.discountCode || '',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  console.log(`✅ Stripe: Checkout sessions creation completed. ${checkoutSessions.filter(s => s.id !== 'error').length}/${bundles.length} successful`);
  return checkoutSessions;
}

export async function verifyCheckoutSession(sessionId: string): Promise<any> {
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'payment_intent']
    });

    console.log(`✅ Stripe: Session verified: ${sessionId}, status: ${session.payment_status}`);
    return session;
  } catch (error) {
    console.error(`❌ Stripe: Error verifying session ${sessionId}:`, error);
    throw error;
  }
}

export async function createBundleWebhook(endpointUrl: string): Promise<string> {
  try {
    const endpoint = await stripe.webhookEndpoints.create({
      url: endpointUrl,
      enabled_events: [
        'checkout.session.completed',
        'payment_intent.succeeded',
        'payment_intent.payment_failed'
      ]
    });

    console.log(`✅ Stripe: Webhook endpoint created: ${endpoint.id}`);
    return endpoint.secret!;
  } catch (error) {
    console.error('❌ Stripe: Error creating webhook:', error);
    throw error;
  }
}