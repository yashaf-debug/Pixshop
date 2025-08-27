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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
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
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    
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
    
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
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