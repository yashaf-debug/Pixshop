



/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI, GenerateContentResponse, Modality } from "@google/genai";

// Helper to convert a data URL string to a File object
export const dataURLtoFile = (dataurl: string, filename: string): File => {
    const arr = dataurl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");

    const mime = mimeMatch[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new File([u8arr], filename, {type:mime});
}

// Helper function to convert a File object to a Gemini API Part
const fileToPart = async (file: File): Promise<{ inlineData: { mimeType: string; data: string; } }> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = error => reject(error);
    });
    
    const arr = dataUrl.split(',');
    if (arr.length < 2) throw new Error("Invalid data URL");
    const mimeMatch = arr[0].match(/:(.*?);/);
    if (!mimeMatch || !mimeMatch[1]) throw new Error("Could not parse MIME type from data URL");
    
    const mimeType = mimeMatch[1];
    const data = arr[1];
    return { inlineData: { mimeType, data } };
};

const handleApiResponse = (
    response: GenerateContentResponse,
    context: string // e.g., "edit", "filter", "adjustment"
): string => {
    // 1. Check for prompt blocking first
    if (response.promptFeedback?.blockReason) {
        const { blockReason, blockReasonMessage } = response.promptFeedback;
        const errorMessage = `Request was blocked. Reason: ${blockReason}. ${blockReasonMessage || ''}`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }

    // 2. Try to find the image part
    const imagePartFromResponse = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

    if (imagePartFromResponse?.inlineData) {
        const { mimeType, data } = imagePartFromResponse.inlineData;
        console.log(`Received image data (${mimeType}) for ${context}`);
        return `data:${mimeType};base64,${data}`;
    }

    // 3. If no image, check for other reasons
    const finishReason = response.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
        const errorMessage = `Image generation for ${context} stopped unexpectedly. Reason: ${finishReason}. This often relates to safety settings.`;
        console.error(errorMessage, { response });
        throw new Error(errorMessage);
    }
    
    const textFeedback = response.text?.trim();
    const errorMessage = `The AI model did not return an image for the ${context}. ` + 
        (textFeedback 
            ? `The model responded with text: "${textFeedback}"`
            : "This can happen due to safety filters or if the request is too complex. Please try rephrasing your prompt to be more direct.");

    console.error(`Model response did not contain an image part for ${context}.`, { response });
    throw new Error(errorMessage);
};

/**
 * Generates an inpainted image using generative AI based on a mask.
 * @param originalImage The original image file.
 * @param maskImage The mask file where white areas indicate what to remove.
 * @returns A promise that resolves to the data URL of the edited image.
 */
export const generateErasedImage = async (
    originalImage: File,
    maskImage: File,
): Promise<string> => {
    console.log('Starting generative erase...');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    const originalImagePart = await fileToPart(originalImage);
    const maskImagePart = await fileToPart(maskImage);
    
    const prompt = `You are an expert photo editor AI performing an inpainting task. The user has provided an original image and a mask image. Your task is to remove the content from the original image that corresponds to the white areas of the mask image. Then, you must fill in the removed areas with a realistic and seamless continuation of the surrounding background. The result must be photorealistic and blend perfectly. The areas of the original image corresponding to the black areas of the mask must remain completely unchanged. Output: Return ONLY the final edited image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending original image, mask, and prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, maskImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    console.log('Received response from model for erase.', response);
    
    return handleApiResponse(response, 'erase');
};

/**
 * Generates an image with a filter applied using generative AI.
 * @param originalImage The original image file.
 * @param filterPrompt The text prompt describing the desired filter.
 * @returns A promise that resolves to the data URL of the filtered image.
 */
export const generateFilteredImage = async (
    originalImage: File,
    filterPrompt: string,
): Promise<string> => {
    console.log(`Starting filter generation: ${filterPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to apply a stylistic filter to the entire image based on the user's request. Do not change the composition or content, only apply the style.
Filter Request: "${filterPrompt}"

Safety & Ethics Policy:
- Filters may subtly shift colors, but you MUST ensure they do not alter a person's fundamental race or ethnicity.
- You MUST REFUSE any request that explicitly asks to change a person's race (e.g., 'apply a filter to make me look Chinese').

Output: Return ONLY the final filtered image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and filter prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    console.log('Received response from model for filter.', response);
    
    return handleApiResponse(response, 'filter');
};

/**
 * Generates an image with a global adjustment applied using generative AI.
 * @param originalImage The original image file.
 * @param adjustmentPrompt The text prompt describing the desired adjustment.
 * @returns A promise that resolves to the data URL of the adjusted image.
 */
export const generateAdjustedImage = async (
    originalImage: File,
    adjustmentPrompt: string,
): Promise<string> => {
    console.log(`Starting global adjustment generation: ${adjustmentPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo editor AI. Your task is to perform a natural, global adjustment to the entire image based on the user's request.
User Request: "${adjustmentPrompt}"

Editing Guidelines:
- The adjustment must be applied across the entire image.
- The result must be photorealistic.

Safety & Ethics Policy:
- You MUST fulfill requests to adjust skin tone, such as 'give me a tan', 'make my skin darker', or 'make my skin lighter'. These are considered standard photo enhancements.
- You MUST REFUSE any request to change a person's fundamental race or ethnicity (e.g., 'make me look Asian', 'change this person to be Black'). Do not perform these edits. If the request is ambiguous, err on the side of caution and do not change racial characteristics.

Output: Return ONLY the final adjusted image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and adjustment prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    console.log('Received response from model for adjustment.', response);
    
    return handleApiResponse(response, 'adjustment');
};

/**
 * Generates a portrait with a specific enhancement applied.
 * @param originalImage The original image file.
 * @param enhancementPrompt The text prompt describing the desired portrait enhancement.
 * @returns A promise that resolves to the data URL of the enhanced image.
 */
export const generatePortraitEnhancement = async (
    originalImage: File,
    enhancementPrompt: string,
): Promise<string> => {
    console.log(`Starting portrait enhancement: ${enhancementPrompt}`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert portrait retouching AI. Your task is to enhance the provided portrait based on the user's request, ensuring the result is natural and high-quality.
User Request: "${enhancementPrompt}"

General Guidelines:
- The subject's identity, facial features, and structure MUST remain unchanged.
- Preserve natural skin texture. Avoid making the skin look overly smooth or plastic-like.
- The changes should be subtle and enhance the existing photo, not create a new person.

Safety & Ethics Policy:
- You MUST REFUSE any request to change a person's fundamental race, ethnicity, or age.

Output: Return ONLY the final enhanced portrait. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and portrait enhancement prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    console.log('Received response from model for portrait enhancement.', response);
    
    return handleApiResponse(response, 'portrait');
};

/**
 * Applies a one-click enhancement to an image, improving quality.
 * @param originalImage The original image file.
 * @returns A promise that resolves to the data URL of the enhanced image.
 */
export const generateEnhancedImage = async (
    originalImage: File
): Promise<string> => {
    console.log('Starting one-click image enhancement...');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const originalImagePart = await fileToPart(originalImage);
    const prompt = `You are an expert photo restoration and enhancement AI. The user has provided an image and requested a one-click "AI Enhance". Your task is to perform a comprehensive set of improvements to make the image look significantly better, as if professionally edited, while maintaining a natural and photorealistic appearance.

Your process should include the following steps, applied intelligently based on the image's needs:
1.  **Upscale & Denoise**: Increase the image's resolution and clarity. Remove digital noise, grain, and compression artifacts, especially in dark areas. If the image is blurry, apply deblurring algorithms to improve focus.
2.  **Color & Tone Correction**: Automatically adjust brightness, contrast, and saturation for a balanced and vibrant look. Correct any color casts (e.g., yellowish or bluish tints) to achieve natural colors.
3.  **Detail Enhancement**: Sharpen key elements of the image, like faces, textures, and architectural details, but avoid over-sharpening that creates halos or a brittle look.
4.  **Lighting Correction**: Improve the overall lighting. If the image is backlit, recover details from the shadows without blowing out the highlights.

The final result must be a high-quality, clean, and visually appealing version of the original image.

Output: Return ONLY the final enhanced image. Do not return text.`;
    const textPart = { text: prompt };

    console.log('Sending image and enhancement prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [originalImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    console.log('Received response from model for enhancement.', response);
    
    return handleApiResponse(response, 'enhancement');
};


/**
 * Combines a subject image with a background image.
 * @param subjectImage The image containing the subject to be cut out.
 * @param backgroundImage The image to be used as the new background.
 * @returns A promise that resolves to the data URL of the combined image.
 */
export const generateCombinedImage = async (
    subjectImage: File,
    backgroundImage: File,
): Promise<string> => {
    console.log('Starting image combination...');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const subjectImagePart = await fileToPart(subjectImage);
    const backgroundImagePart = await fileToPart(backgroundImage);
    
    const prompt = `You are an expert photo editor AI. Your task is to accurately identify the main subject in the first image, remove its original background, and seamlessly composite it onto the second image, which serves as the new background. 
    
    Ensure the lighting, shadows, and perspective of the subject match the new background realistically.
    
    The first image provided is the subject image. The second image is the new background.
    
    Output: Return ONLY the final combined image. Do not return text.`;

    const textPart = { text: prompt };

    console.log('Sending subject image, background image, and prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [subjectImagePart, backgroundImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    console.log('Received response from model for combination.', response);
    
    return handleApiResponse(response, 'combine');
};

/**
 * Removes the background from an image, making it transparent.
 * @param subjectImage The image containing the subject.
 * @returns A promise that resolves to the data URL of the image with a transparent background.
 */
export const generateRemovedBackgroundImage = async (
    subjectImage: File,
): Promise<string> => {
    console.log('Starting background removal...');
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const subjectImagePart = await fileToPart(subjectImage);
    
    const prompt = `You are an expert photo editor AI. Your task is to accurately identify the main subject in the provided image and completely remove its background, making the background transparent. 
    
    The output MUST be a PNG image with a transparent alpha channel. Do not add any new background or color. The subject must be perfectly preserved.
    
    Output: Return ONLY the final image with the transparent background. Do not return text.`;

    const textPart = { text: prompt };

    console.log('Sending image and background removal prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [subjectImagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    console.log('Received response from model for background removal.', response);
    
    return handleApiResponse(response, 'background_removal');
};


/**
 * Expands an image by generating new content around it (outpainting).
 * @param originalImageFile The original image file.
 * @param prompt A text prompt to guide the content generation.
 * @param targetWidth The width of the final expanded image.
 * @param targetHeight The height of the final expanded image.
 * @param imageX The x-coordinate where the original image is placed on the new canvas.
 * @param imageY The y-coordinate where the original image is placed on the new canvas.
 * @returns A promise that resolves to the data URL of the expanded image.
 */
export const generateExpandedImage = async (
    originalImageFile: File,
    prompt: string,
    targetWidth: number,
    targetHeight: number,
    imageX: number,
    imageY: number,
): Promise<string> => {
    console.log('Starting generative expand (outpainting)...');
    
    const originalImage = new Image();
    const originalImageUrl = URL.createObjectURL(originalImageFile);
    await new Promise<void>((resolve, reject) => {
        originalImage.onload = () => {
            URL.revokeObjectURL(originalImageUrl);
            resolve();
        };
        originalImage.onerror = reject;
        originalImage.src = originalImageUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error("Could not create canvas context for expansion.");

    ctx.drawImage(originalImage, imageX, imageY);
    const canvasDataUrl = canvas.toDataURL('image/png');
    const canvasFile = dataURLtoFile(canvasDataUrl, 'expand_canvas.png');
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const canvasPart = await fileToPart(canvasFile);
    
    const textPrompt = `You are an expert photo editor AI performing an outpainting task. The user has provided an image placed on a larger transparent canvas. Your task is to fill in the surrounding transparent areas with new, realistic content that seamlessly extends the original image.

    The user has provided an optional text prompt to guide the generation: "${prompt || 'No specific prompt provided, continue the scene naturally.'}"

    The final image must be fully opaque and have the exact same dimensions as the input canvas (${targetWidth}x${targetHeight} pixels). Do not change the original image content that has been provided.

    Output: Return ONLY the final edited image. Do not return text.`;
    const textPart = { text: textPrompt };

    console.log('Sending composed canvas and expand prompt to the model...');
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image-preview',
        contents: { parts: [canvasPart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE, Modality.TEXT],
        },
    });
    console.log('Received response from model for expand.', response);
    
    return handleApiResponse(response, 'expand');
};

/**
 * Generates images from a text prompt.
 * @param prompt The text description of the image to generate.
 * @param numberOfImages The number of images to generate.
 * @param aspectRatio The desired aspect ratio of the images.
 * @returns A promise that resolves to an array of data URLs of the generated images.
 */
export const generateImagesFromPrompt = async (
    prompt: string,
    numberOfImages: number,
    aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4',
): Promise<string[]> => {
    console.log(`Starting text-to-image generation for: "${prompt}"`);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateImages({
        model: 'imagen-4.0-generate-001',
        prompt,
        config: {
            numberOfImages,
            aspectRatio,
            outputMimeType: 'image/png',
        },
    });
    
    console.log('Received response from model for image generation.', response);

    if (!response.generatedImages || response.generatedImages.length === 0) {
        // Fix: Property 'promptFeedback' does not exist on type 'GenerateImagesResponse'.
        // The check for a block reason has been removed as `promptFeedback` is not part of the `GenerateImagesResponse` type.
        // If image generation fails, a generic error message will be thrown.
        throw new Error('The AI model did not return any images. This may be due to safety filters or a problem with the prompt.');
    }

    return response.generatedImages.map(img => {
        const base64ImageBytes: string = img.image.imageBytes;
        return `data:image/png;base64,${base64ImageBytes}`;
    });
};
