'use client';

import { useState } from 'react';

interface Bundle {
  name: string;
  rationale: string;
  skus: string[];
  targetPrice: number;
  discountPercent: number;
  emailBlurb: string;
  heroImageIdea: string;
  bundleImageUrl?: string;
  childProductImages?: string[];
}

interface CampaignPlan {
  theme: string;
  bundles: Bundle[];
  overallStrategy: string;
  targetAudience: string;
}

export default function Home() {
  const [theme, setTheme] = useState('Fall Essentials');
  const [plan, setPlan] = useState<CampaignPlan | null>(null);
  const [products, setProducts] = useState<Record<string, any>>({});
  const [selectedBundles, setSelectedBundles] = useState<Set<number>>(new Set());
  const [expandedBundles, setExpandedBundles] = useState<Set<number>>(new Set());
  const [showBundlePreview, setShowBundlePreview] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [bundleCreationResult, setBundleCreationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [creatingBundles, setCreatingBundles] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [optimizedHtml, setOptimizedHtml] = useState<string | null>(null);

  const generatePlan = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate plan');
      }

      setPlan(data.plan);
      setProducts(data.products || {});
      // Select all bundles by default
      setSelectedBundles(new Set(data.plan.bundles.map((_: any, index: number) => index)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const toggleBundle = (index: number) => {
    const newSelected = new Set(selectedBundles);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedBundles(newSelected);
  };

  const getSelectedPlan = () => {
    if (!plan) return null;
    return {
      ...plan,
      bundles: plan.bundles.filter((_: any, index: number) => selectedBundles.has(index))
    };
  };

  const toggleBundleExpansion = (index: number) => {
    const newExpanded = new Set(expandedBundles);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedBundles(newExpanded);
  };

  const previewBundleCreation = () => {
    setShowBundlePreview(true);
  };

  const createBundleProducts = async () => {
    const selectedPlan = getSelectedPlan();
    if (!selectedPlan) return;

    setCreatingBundles(true);
    setError(null);
    try {
      const response = await fetch('/api/create-bundles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create bundle products');
      }

      setBundleCreationResult(data);
      setShowBundlePreview(false); // Hide preview after successful creation
      alert(`✅ Bundle products created successfully!\n\n${data.bundleResult.successfulProducts}/${data.bundleResult.totalBundles} bundles created in commercetools`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create bundle products');
    } finally {
      setCreatingBundles(false);
    }
  };


  const previewChanges = async () => {
    const selectedPlan = getSelectedPlan();
    if (!selectedPlan) return;

    setLoading(true);
    try {
      const response = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: selectedPlan, dryRun: true }),
      });

      const data = await response.json();
      setDryRunResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to preview changes');
    } finally {
      setLoading(false);
    }
  };

  const previewTemplate = () => {
    const selectedPlan = getSelectedPlan();
    if (!selectedPlan) return;

    // Use optimized HTML if available, otherwise generate default HTML
    const html = optimizedHtml || generateCampaignHTML(selectedPlan.bundles, selectedPlan.theme);
    setEmailPreview(html);
    setShowPreview(true);
  };

  const generateCampaignHTML = (bundles: Bundle[], theme: string): string => {
    const bundleHTML = bundles.map((bundle, index) => {
      // Find the corresponding created product if available
      const createdProduct = bundleCreationResult?.bundleResult?.products?.find((p: any) => p.name === bundle.name);

      // Generate product URL - use real product link if available, otherwise placeholder
      const productUrl = createdProduct?.slug
        ? `https://your-store.com/products/${createdProduct.slug}`
        : "#shop-bundle";

      return `
      <div style="margin: 20px 0; padding: 20px; border: 1px solid #ddd; border-radius: 8px;">
        <h2 style="color: #333; margin: 0 0 10px 0;">${bundle.name}</h2>
        <p style="color: #666; line-height: 1.6; margin: 10px 0;">${bundle.emailBlurb}</p>
        <div style="margin: 15px 0;">
          <span style="font-size: 24px; font-weight: bold; color: #e74c3c;">$${(bundle.targetPrice / 100).toFixed(2)}</span>
          <span style="margin-left: 10px; color: #27ae60; font-weight: bold;">${bundle.discountPercent}% OFF</span>
        </div>
        <p style="font-style: italic; color: #888; font-size: 12px;">Bundle includes: ${bundle.skus.join(', ')}</p>
        ${createdProduct ?
          `<p style="font-size: 10px; color: #27ae60; margin: 5px 0;">✅ Available in commercetools (SKU: ${createdProduct.sku})</p>` :
          `<p style="font-size: 10px; color: #f39c12; margin: 5px 0;">⚠️ Bundle product not yet created</p>`
        }
        <div style="margin-top: 15px;">
          <a href="${productUrl}" style="background-color: #3498db; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            ${createdProduct ? 'Shop This Bundle' : 'Shop Now'}
          </a>
        </div>
      </div>
    `;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${theme} - Limited-Time Bundles</title>
        <style>
          body { font-family: 'Arial', sans-serif; max-width: 600px; margin: 0 auto; }
        </style>
      </head>
      <body>
        <div style="text-align: center; padding: 20px; background-color: #f8f9fa;">
          <h1 style="color: #2c3e50; margin: 0;">${theme}</h1>
          <p style="color: #7f8c8d; margin: 10px 0 0 0;">Exclusive Bundle Deals Just For You</p>
        </div>

        <div style="padding: 20px;">
          ${bundleHTML}

          <div style="text-align: center; margin-top: 30px; padding: 20px; background-color: #ecf0f1; border-radius: 8px;">
            <p style="color: #34495e; margin: 0; font-size: 14px;">
              These exclusive bundles are available for a limited time only.
            </p>
          </div>
        </div>

        <div style="text-align: center; padding: 20px; background-color: #f8f9fa; color: #7f8c8d; font-size: 12px;">
          <p>Generated by AI Merchandising Co-Pilot</p>
        </div>
      </body>
      </html>
    `;
  };

  const polishWithLovable = async () => {
    const selectedPlan = getSelectedPlan();
    if (!selectedPlan) return;

    setPolishing(true);
    setError(null);

    try {
      const currentHtml = optimizedHtml || generateCampaignHTML(selectedPlan.bundles, selectedPlan.theme);
      const campaignText = selectedPlan.theme;

      const response = await fetch('/api/polish-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          html: currentHtml,
          campaignText,
          generateImage: true
        }),
      });

      const data = await response.json();

      if (response.ok) {
        console.log('🔍 Frontend: Received polished HTML from Lovable');
        console.log('🔍 Frontend: Polished HTML length:', data.optimizedHtml?.length);
        console.log('🔍 Frontend: Polished HTML preview:', data.optimizedHtml?.substring(0, 200) + '...');

        setOptimizedHtml(data.optimizedHtml);
        setEmailPreview(data.optimizedHtml);
        setShowPreview(true);
        alert(`✅ Email template polished successfully!\n\n${data.message || 'Template enhanced with improved design and layout.'}`);
      } else {
        let errorMessage = `❌ ${data.error || 'Failed to polish email template'}`;
        if (data.details) {
          errorMessage += `\n\nDetails: ${data.details}`;
        }
        if (data.suggestions && data.suggestions.length > 0) {
          errorMessage += `\n\nSuggestions:\n• ${data.suggestions.join('\n• ')}`;
        }
        throw new Error(errorMessage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to polish email template');
    } finally {
      setPolishing(false);
    }
  };

  const pushToKlaviyo = async () => {
    const selectedPlan = getSelectedPlan();
    if (!selectedPlan) return;

    // Check if polished email is required
    if (!optimizedHtml) {
      alert('⚠️ Please polish the email with Lovable first!\n\nClick "Polish with Lovable" to enhance the email template before pushing to Klaviyo.');
      return;
    }

    console.log('🔍 Frontend: About to push to Klaviyo with optimized HTML');
    console.log('🔍 Frontend: optimizedHtml length:', optimizedHtml?.length);
    console.log('🔍 Frontend: optimizedHtml preview:', optimizedHtml?.substring(0, 200) + '...');

    setPushing(true);
    try {
      // Only use polished HTML - no fallback to unpolished version
      // Also include bundle creation result for real product links
      const enhancedPlan = {
        ...selectedPlan,
        customHtml: optimizedHtml, // Required polished HTML
        bundleCreationResult: bundleCreationResult
      };

      console.log('🔍 Frontend: Enhanced plan structure:', {
        theme: enhancedPlan.theme,
        bundlesCount: enhancedPlan.bundles?.length,
        hasCustomHtml: !!enhancedPlan.customHtml,
        customHtmlLength: enhancedPlan.customHtml?.length,
        customHtmlPreview: enhancedPlan.customHtml?.substring(0, 100) + '...',
        hasBundleCreationResult: !!enhancedPlan.bundleCreationResult
      });

      const response = await fetch('/api/klaviyo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: enhancedPlan }),
      });

      const data = await response.json();

      if (response.ok) {
        let message = `🎉 Campaign created successfully!\n\n`;
        message += `Campaign ID: ${data.campaign.id}\n`;
        message += `Subject: ${data.preview?.subject}\n`;
        message += `Bundles: ${data.summary?.bundleCount}\n`;

        if (data.campaign.status === 'mock_created') {
          message += `\n⚠️ Demo Mode: Mock campaign created\n`;
          message += `For production, check your Klaviyo API key permissions`;
        } else {
          message += `\n✅ Real Campaign: Draft created in your Klaviyo account\n`;
          message += `Message ID: ${data.campaign.campaign?.message_id || 'N/A'}\n`;
          message += `Template ID: ${data.campaign.campaign?.template_id || 'N/A'}`;
        }

        if (data.warnings && data.warnings.length > 0) {
          message += '\n\nNotes:\n' + data.warnings.join('\n');
        }

        alert(message);
      } else {
        throw new Error(data.error || 'Failed to create campaign');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to push to Klaviyo');
    } finally {
      setPushing(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🤖 AI Merchandising Co‑Pilot
          </h1>
          <p className="text-gray-600">
            Generate intelligent product bundles and campaigns with AI
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">❌ {error}</p>
          </div>
        )}

        {/* Step 1: Generate Campaign Plan */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Step 1: Generate Campaign</h2>
          <div className="flex gap-4">
            <input
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              placeholder="Enter campaign theme (e.g., Fall Essentials)"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              onClick={generatePlan}
              disabled={loading || !theme.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Generating...' : '🎯 Generate Plan'}
            </button>
          </div>
        </div>

        {/* Step 2: Review Generated Bundles */}
        {plan && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Step 2: Generated Bundles</h2>
            <div className="mb-4 p-4 bg-blue-50 rounded-lg">
              <p><strong>Strategy:</strong> {plan.overallStrategy}</p>
              <p><strong>Target Audience:</strong> {plan.targetAudience}</p>
            </div>
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                ✅ <strong>{selectedBundles.size}</strong> of <strong>{plan.bundles.length}</strong> bundles selected.
                Check/uncheck bundles to include in your campaign.
              </p>
            </div>

            <div className="grid gap-4">
              {plan.bundles.map((bundle, index) => (
                <div key={index} className={`border rounded-lg p-4 transition-all ${
                  selectedBundles.has(index)
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-200 bg-gray-50'
                }`}>
                  <div className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={selectedBundles.has(index)}
                      onChange={() => toggleBundle(index)}
                      className="mt-1 h-4 w-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-lg">{bundle.name}</h3>
                          {/* Bundle Image Preview */}
                          {bundle.bundleImageUrl && !bundle.bundleImageUrl.includes('placeholder') && (
                            <img
                              src={bundle.bundleImageUrl}
                              alt={bundle.name}
                              className="w-8 h-8 rounded object-cover border"
                            />
                          )}
                        </div>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-green-600">
                            ${(bundle.targetPrice / 100).toFixed(2)}
                          </span>
                          <span className="ml-2 bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                            {bundle.discountPercent}% OFF
                          </span>
                        </div>
                      </div>
                      <p className="text-gray-600 mb-2">{bundle.rationale}</p>

                      {/* Products Toggle Button */}
                      <div className="flex items-center justify-between mb-2">
                        <div className="text-sm text-gray-500">
                          <strong>Products ({bundle.skus.length}):</strong>
                        </div>
                        <button
                          onClick={() => toggleBundleExpansion(index)}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 focus:outline-none"
                        >
                          {expandedBundles.has(index) ? '▼ Hide Details' : '▶ Show Details'}
                        </button>
                      </div>

                      {/* Collapsed Product Names */}
                      {!expandedBundles.has(index) && (
                        <div className="mt-1 flex flex-wrap gap-2 mb-2">
                          {bundle.skus.map((sku: string) => (
                            <span key={sku} className="bg-white px-2 py-1 rounded border text-xs">
                              {products[sku]?.name || sku}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Expanded Product Details */}
                      {expandedBundles.has(index) && (
                        <div className="mt-2 mb-3 p-3 bg-white rounded-lg border">
                          <h4 className="font-medium text-sm mb-3 text-gray-700">Bundle Contents:</h4>
                          <div className="grid gap-3">
                            {bundle.skus.map((sku: string) => {
                              const product = products[sku];
                              return (
                                <div key={sku} className="flex items-start gap-3 p-2 bg-gray-50 rounded">
                                  {/* Product Image */}
                                  {product?.mainImage ? (
                                    <img
                                      src={product.mainImage}
                                      alt={product.name || sku}
                                      className="w-16 h-16 rounded object-cover border flex-shrink-0"
                                    />
                                  ) : (
                                    <div className="w-16 h-16 bg-gray-200 rounded border flex-shrink-0 flex items-center justify-center">
                                      <span className="text-xs text-gray-500">No Image</span>
                                    </div>
                                  )}

                                  {/* Product Info */}
                                  <div className="flex-1 min-w-0">
                                    <h5 className="font-medium text-sm text-gray-900 truncate">
                                      {product?.name || `Product ${sku}`}
                                    </h5>
                                    <p className="text-xs text-gray-500 mt-1">SKU: {sku}</p>
                                    {product?.price && (
                                      <p className="text-xs text-gray-600 mt-1">
                                        Individual Price: ${(product.price / 100).toFixed(2)}
                                      </p>
                                    )}
                                    {product?.stock !== undefined && (
                                      <p className="text-xs text-gray-600">
                                        Stock: {product.stock} available
                                      </p>
                                    )}
                                    {product?.tags && product.tags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {product.tags.slice(0, 3).map((tag: string, idx: number) => (
                                          <span key={idx} className="text-xs bg-blue-100 text-blue-700 px-1 rounded">
                                            {tag}
                                          </span>
                                        ))}
                                        {product.tags.length > 3 && (
                                          <span className="text-xs text-gray-500">+{product.tags.length - 3}</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Bundle Value Calculation */}
                          <div className="mt-3 pt-3 border-t bg-green-50 p-2 rounded">
                            <div className="text-sm">
                              <div className="flex justify-between">
                                <span>Individual Total:</span>
                                <span>${(bundle.skus.reduce((total: number, sku: string) => {
                                  const product = products[sku];
                                  return total + (product?.price || 0);
                                }, 0) / 100).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between font-medium text-green-700">
                                <span>Bundle Price:</span>
                                <span>${(bundle.targetPrice / 100).toFixed(2)}</span>
                              </div>
                              <div className="flex justify-between text-sm text-green-600">
                                <span>You Save:</span>
                                <span>${((bundle.skus.reduce((total: number, sku: string) => {
                                  const product = products[sku];
                                  return total + (product?.price || 0);
                                }, 0) - bundle.targetPrice) / 100).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <p className="text-sm italic text-gray-600">{bundle.emailBlurb}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <button
                onClick={previewBundleCreation}
                disabled={selectedBundles.size === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                👀 Preview Bundle Creation
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Bundle Creation Preview */}
        {showBundlePreview && plan && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Step 3: Bundle Creation Preview</h2>

            {/* Overview Stats */}
            <div className="mb-6 grid grid-cols-4 gap-4 text-center">
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-2xl font-bold text-blue-600">
                  {selectedBundles.size}
                </div>
                <div className="text-sm text-gray-600">Bundles Selected</div>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <div className="text-2xl font-bold text-green-600">
                  ${((getSelectedPlan()?.bundles?.reduce((sum, b) => sum + b.targetPrice, 0) || 0) / 100).toFixed(0)}
                </div>
                <div className="text-sm text-gray-600">Total Value</div>
              </div>
              <div className="bg-purple-50 p-4 rounded">
                <div className="text-2xl font-bold text-purple-600">
                  {Math.round((getSelectedPlan()?.bundles?.reduce((sum, b) => sum + b.discountPercent, 0) || 0) / selectedBundles.size || 0)}%
                </div>
                <div className="text-sm text-gray-600">Avg Discount</div>
              </div>
              <div className="bg-orange-50 p-4 rounded">
                <div className="text-2xl font-bold text-orange-600">
                  {getSelectedPlan()?.bundles?.reduce((sum, b) => sum + b.skus.length, 0) || 0}
                </div>
                <div className="text-sm text-gray-600">Products Bundled</div>
              </div>
            </div>

            {/* Bundle Details */}
            <div className="mb-6">
              <h3 className="font-semibold mb-3">Bundles to be Created in commercetools:</h3>
              <div className="grid gap-3 max-h-60 overflow-y-auto">
                {getSelectedPlan()?.bundles.map((bundle, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-semibold text-lg">{bundle.name}</h4>
                      <div className="text-right">
                        <span className="text-xl font-bold text-green-600">
                          ${(bundle.targetPrice / 100).toFixed(2)}
                        </span>
                        <span className="ml-2 bg-red-100 text-red-800 px-2 py-1 rounded text-sm font-medium">
                          {bundle.discountPercent}% OFF
                        </span>
                      </div>
                    </div>
                    <p className="text-gray-600 text-sm mb-2">{bundle.emailBlurb}</p>
                    <div className="text-xs text-gray-500">
                      <strong>SKUs to bundle:</strong> {bundle.skus.join(', ')}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      <strong>Rationale:</strong> {bundle.rationale}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4">
              <button
                onClick={createBundleProducts}
                disabled={creatingBundles}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {creatingBundles ? '⏳ Creating in commercetools...' : '🛍️ Create Bundle Products'}
              </button>

              <button
                onClick={() => setShowBundlePreview(false)}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                ← Back to Bundle Selection
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Bundle Products Created */}
        {bundleCreationResult && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Step 4: Bundle Products Created</h2>
            <div className="mb-4 grid grid-cols-3 gap-4 text-center">
              <div className="bg-green-50 p-4 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {bundleCreationResult.bundleResult?.successfulProducts || 0}
                </div>
                <div className="text-sm text-gray-600">Created Successfully</div>
              </div>
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-2xl font-bold text-blue-600">
                  {bundleCreationResult.bundleResult?.totalBundles || 0}
                </div>
                <div className="text-sm text-gray-600">Total Bundles</div>
              </div>
              <div className="bg-red-50 p-4 rounded">
                <div className="text-2xl font-bold text-red-600">
                  {bundleCreationResult.bundleResult?.failedProducts || 0}
                </div>
                <div className="text-sm text-gray-600">Failed</div>
              </div>
            </div>

            {bundleCreationResult.bundleResult?.products && (
              <div className="mt-4">
                <h3 className="font-medium mb-2">Created Bundle Products:</h3>
                <div className="grid gap-2 max-h-40 overflow-y-auto">
                  {bundleCreationResult.bundleResult.products
                    .filter((p: any) => p.productId)
                    .map((product: any, index: number) => (
                      <div key={index} className="flex justify-between items-center bg-gray-50 p-2 rounded text-sm">
                        <span className="font-medium">{product.name}</span>
                        <div className="flex gap-2">
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                            SKU: {product.sku}
                          </span>
                          <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            ${(product.targetPrice / 100).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="mt-6">
              <button
                onClick={previewChanges}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? '⏳ Processing...' : '👀 Continue to Campaign Preview'}
              </button>
            </div>
          </div>
        )}


        {/* Step 5: Campaign Preview */}
        {dryRunResult && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Step 5: Campaign Preview</h2>
            <div className="mb-4 grid grid-cols-2 gap-4 text-center">
              <div className="bg-blue-50 p-4 rounded">
                <div className="text-3xl font-bold text-blue-600">
                  {bundleCreationResult?.bundleResult?.successfulProducts || selectedBundles.size}
                </div>
                <div className="text-sm text-gray-600">Created Bundles</div>
              </div>
              <div className="bg-green-50 p-4 rounded">
                <div className="text-2xl font-bold text-green-600">
                  {plan?.theme || 'Campaign Theme'}
                </div>
                <div className="text-sm text-gray-600">Campaign Topic</div>
              </div>
            </div>

            {/* Email Status Indicator */}
            <div className="mt-4 p-3 rounded-lg border-l-4 border-l-blue-500 bg-blue-50">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-blue-800">
                    Email Status: {optimizedHtml ? '✨ Polished & Ready' : '📝 Basic Template'}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    {optimizedHtml
                      ? 'Email has been enhanced by Lovable AI and is ready for Klaviyo'
                      : 'Email template generated. Use "Polish with Lovable" to enhance before sending to Klaviyo'
                    }
                  </p>
                </div>
                {optimizedHtml && (
                  <div className="flex items-center gap-1 text-green-600">
                    <span className="text-lg">✅</span>
                    <span className="text-xs font-medium">POLISHED</span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex gap-4 flex-wrap">
              <button
                onClick={previewTemplate}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                📧 Preview Email Template
              </button>

              <button
                onClick={polishWithLovable}
                disabled={polishing || loading}
                className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {polishing ? '⏳ Polishing...' : '✨ Polish with Lovable'}
              </button>

              <button
                onClick={pushToKlaviyo}
                disabled={pushing || !optimizedHtml}
                className={`px-6 py-2 text-white rounded-lg disabled:opacity-50 ${
                  optimizedHtml
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-gray-400 cursor-not-allowed'
                }`}
                title={!optimizedHtml ? 'Please polish the email with Lovable first' : 'Push polished email to Klaviyo'}
              >
                {pushing
                  ? '⏳ Creating Campaign...'
                  : optimizedHtml
                    ? '🚀 Push to Klaviyo (Polished)'
                    : '🚀 Push to Klaviyo (Polish Required)'
                }
              </button>
            </div>
          </div>
        )}

        {/* Email Preview Modal */}
        {showPreview && emailPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
              <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-semibold">📧 Email Template Preview</h3>
                <button
                  onClick={() => setShowPreview(false)}
                  className="text-gray-500 hover:text-gray-700 text-xl"
                >
                  ×
                </button>
              </div>
              <div className="p-4 overflow-auto max-h-[calc(90vh-120px)]">
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(emailPreview)}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                  >
                    📋 Copy HTML
                  </button>
                  {optimizedHtml && (
                    <span className="px-4 py-2 bg-purple-100 text-purple-800 rounded text-sm font-medium">
                      ✨ Enhanced with Lovable
                    </span>
                  )}
                  {!optimizedHtml && (
                    <span className="px-4 py-2 bg-gray-100 text-gray-600 rounded text-sm">
                      📧 Default Template
                    </span>
                  )}
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <iframe
                    srcDoc={emailPreview}
                    className="w-full h-96 border-0"
                    title="Email Preview"
                  />
                </div>
                <details className="mt-4">
                  <summary className="cursor-pointer text-sm text-gray-600 hover:text-gray-800">
                    View HTML Source
                  </summary>
                  <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-40">
                    {emailPreview}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        )}

        {/* Demo Instructions */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold mb-2">🎯 4-Minute Demo Script</h3>
          <ol className="list-decimal list-inside space-y-1 text-sm">
            <li><strong>Step 1:</strong> Enter a campaign theme (e.g., "Holiday Gift Sets")</li>
            <li><strong>Step 2:</strong> Click "Generate Plan" to create AI-powered bundles</li>
            <li><strong>Step 3:</strong> Review and select bundles, then click "Preview Bundle Creation" to see overview</li>
            <li><strong>Step 4:</strong> Review bundle details, pricing, and impact - then click "Create Bundle Products"</li>
            <li><strong>Step 5:</strong> Review campaign preview with created bundles and campaign topic</li>
            <li><strong>Step 6:</strong> Finalize campaign:</li>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Click "Preview Email Template" to see the design with real product links</li>
              <li>✨ <strong>Required:</strong> Click "Polish with Lovable" to enhance styling and add AI-generated images</li>
              <li>Click "Push to Klaviyo" (only available after polishing) to create the final campaign draft</li>
            </ul>
          </ol>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              <strong>New:</strong> AI-generated bundle images using DALL-E 3 create professional product photography for each bundle, stored locally and integrated with commercetools for high-quality campaign assets.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
