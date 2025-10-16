import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface CampaignInput {
  theme: string;
  catalogSample: Array<{
    id: string;
    name: string;
    price: number;
    stock: number;
    tags: string[];
    images: string[];
    mainImage: string | null;
  }>;
}

export interface Bundle {
  name: string;
  rationale: string;
  skus: string[];
  targetPrice: number;
  discountPercent: number;
  emailBlurb: string;
  heroImageIdea: string;
  bundleImageUrl?: string; // Generated bundle image URL
  childProductImages: string[]; // Images from child products
}

export interface CampaignPlan {
  theme: string;
  bundles: Bundle[];
  overallStrategy: string;
  targetAudience: string;
}

export async function planCampaign(input: CampaignInput): Promise<CampaignPlan> {
  console.log(`🧠 AI: Starting campaign planning for theme "${input.theme}" with ${input.catalogSample.length} products`);

  const systemPrompt = `You are a senior e-commerce merchandiser with 15+ years of experience.
Given products with stock/price/tags, propose 3–5 bundles that are likely to convert this week.

Each bundle must include:
- name: Catchy bundle name
- rationale: Why this bundle will work (2-3 sentences)
- skus: Array of product IDs to include
- targetPrice: Suggested bundle price in cents
- discountPercent: Discount percentage to apply
- emailBlurb: Marketing copy for email (50-80 words)
- heroImageIdea: Description of ideal hero image for this bundle

Also provide:
- overallStrategy: 2-3 sentence strategy for the campaign
- targetAudience: Who should receive this campaign

Return valid JSON only with this exact structure:
{
  "theme": "string",
  "bundles": [Bundle],
  "overallStrategy": "string",
  "targetAudience": "string"
}`;

  const userContent = `
Theme: ${input.theme}

Available Products:
${input.catalogSample.map(p =>
  `- ${p.name} (ID: ${p.id})
    Price: ${p.price} cents
    Stock: ${p.stock}
    Tags: ${p.tags.join(', ')}
    Main Image: ${p.mainImage || 'No image available'}`
).join('\n')}

Create compelling bundles that maximize conversion and AOV. Consider product images when creating bundles - products with good images should be prioritized for visual marketing appeal.`;

  try {
    console.log(`🚀 AI: Calling OpenAI gpt-4o-mini...`);
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    });
    console.log(`✅ AI: OpenAI response received`);

    console.log(`📝 AI: Parsing response...`);

    const content = response.choices[0].message?.content || '{}';
    const plan = JSON.parse(content) as CampaignPlan;

    // Enhance bundles with child product images and validate names
    const enhancedBundles = await Promise.all(plan.bundles.map(async (bundle, index) => {
      // Ensure bundle has a proper name
      const bundleName = bundle.name?.trim() || `${input.theme} Bundle ${index + 1}`;

      // Find child product images for each bundle
      const childProductImages = bundle.skus
        .map(sku => {
          const product = input.catalogSample.find(p => p.id === sku);
          return product?.mainImage;
        })
        .filter(Boolean); // Remove null/undefined images

      // Generate a bundle image URL using DALL-E
      const bundleImageUrl = await generateBundleImage(childProductImages, bundleName, input.theme, input.catalogSample);

      return {
        ...bundle,
        name: bundleName, // Ensure name is always set
        emailBlurb: bundle.emailBlurb?.trim() || `Discover amazing savings with this ${bundleName.toLowerCase()} collection.`,
        childProductImages,
        bundleImageUrl
      };
    }));

    const finalPlan = {
      theme: plan.theme || input.theme,
      bundles: enhancedBundles,
      overallStrategy: plan.overallStrategy || 'Generated bundle campaign strategy',
      targetAudience: plan.targetAudience || 'General audience'
    };

    console.log(`🎯 AI: Campaign plan generated successfully - ${finalPlan.bundles.length} bundles created with images`);
    return finalPlan;
  } catch (error) {
    console.error('❌ AI: Error generating campaign plan:', error);
    throw new Error('Failed to generate campaign plan');
  }
}

async function generateBundleImage(childProductImages: string[], bundleName: string, theme: string, catalogSample: any[]): Promise<string> {
  console.log(`🖼️ AI: Generating DALL-E image for bundle "${bundleName}" with ${childProductImages.length} child product images`);

  // Always provide a fallback first
  let fallbackImage = '';
  if (childProductImages.length > 0) {
    fallbackImage = childProductImages[0];
    console.log(`🔄 AI: Fallback image set to first child product image: ${fallbackImage}`);
  } else {
    fallbackImage = `https://via.placeholder.com/600x400/667eea/ffffff?text=${encodeURIComponent(bundleName)}`;
    console.log(`🔄 AI: Fallback image set to placeholder: ${fallbackImage}`);
  }

  try {
    // Create a detailed prompt based on the bundle contents
    const productDescriptions = catalogSample
      .filter(product => childProductImages.includes(product.mainImage))
      .map(product => product.name)
      .join(', ');

    if (!productDescriptions) {
      console.log(`⚠️ AI: No product descriptions found, using fallback for bundle "${bundleName}"`);
      return fallbackImage;
    }

    // Create a sophisticated prompt for DALL-E
    const imagePrompt = `Create a professional product photography style image for an e-commerce bundle called "${bundleName}". Show these products artfully arranged together: ${productDescriptions}. Style: clean white background, professional lighting, attractive product arrangement, premium e-commerce photography style. The image should look like a high-end product bundle photo for a ${theme.toLowerCase()} campaign. Products should be clearly visible and attractively displayed together.`;

    console.log(`🚀 AI: Calling DALL-E with prompt: ${imagePrompt.substring(0, 150)}...`);
    console.log(`🚀 AI: Product descriptions: ${productDescriptions}`);

    const response = await openai.images.generate({
      model: 'dall-e-3',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
      response_format: 'url'
    });

    if (response.data && response.data[0] && response.data[0].url) {
      const imageUrl = response.data[0].url;
      console.log(`✅ AI: DALL-E image generated successfully: ${imageUrl.substring(0, 100)}...`);

      // Download and save the image locally
      const localImagePath = await saveImageLocally(imageUrl, bundleName, theme);
      console.log(`💾 AI: Image saved locally as: ${localImagePath}`);
      return localImagePath;
    } else {
      console.warn(`⚠️ AI: No image URL in DALL-E response, using fallback`);
      return fallbackImage;
    }

  } catch (error) {
    console.error(`❌ AI: Error generating DALL-E image for "${bundleName}":`, error);
    console.log(`🔄 AI: Using fallback image due to error: ${fallbackImage}`);
    return fallbackImage;
  }
}

async function saveImageLocally(imageUrl: string, bundleName: string, theme: string): Promise<string> {
  const fs = require('fs').promises;
  const path = require('path');

  try {
    // Create a safe filename
    const safeFileName = `${theme.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${bundleName.replace(/[^a-z0-9]/gi, '-').toLowerCase()}-${Date.now()}.jpg`;
    const publicPath = path.join(process.cwd(), 'public', 'bundle-images', safeFileName);

    console.log(`💾 AI: Downloading image from: ${imageUrl.substring(0, 100)}...`);
    console.log(`💾 AI: Saving to: ${publicPath}`);

    // Ensure the directory exists
    const dir = path.dirname(publicPath);
    await fs.mkdir(dir, { recursive: true });

    // Download the image with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    const response = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AI-Bundle-Generator/1.0)'
      }
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();
    console.log(`💾 AI: Downloaded ${buffer.byteLength} bytes`);

    await fs.writeFile(publicPath, Buffer.from(buffer));

    // Return the public URL path
    const publicUrl = `/bundle-images/${safeFileName}`;
    console.log(`✅ AI: Image saved successfully at ${publicUrl}`);
    return publicUrl;

  } catch (error) {
    console.error('❌ AI: Error saving image locally:', error);
    console.log('🔄 AI: Returning original URL as fallback');
    // Return the original URL as fallback
    return imageUrl;
  }
}

export async function polishCopy(brandVoicePrompt: string, text: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a copywriter. Polish the given text to match this brand voice: ${brandVoicePrompt}. Return only the polished text, no additional commentary.`
        },
        { role: 'user', content: text },
      ],
      temperature: 0.5,
    });

    return response.choices[0].message?.content || text;
  } catch (error) {
    console.error('Error polishing copy:', error);
    return text; // Graceful fallback
  }
}