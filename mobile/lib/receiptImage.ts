import * as ImageManipulator from "expo-image-manipulator";

/** Long edge after resize — keeps small digits sharp, uploads under 4 MB. */
const MAX_EDGE = 2000;

/**
 * Receipt photos: cap the size and re-encode at high quality before upload.
 * Contrast / sharpening happens server-side via a Cloudinary transform, since
 * the on-device manipulator has no contrast filter.
 */
export async function prepareReceiptImage(uri: string): Promise<string> {
  try {
    const probe = await ImageManipulator.manipulateAsync(uri, []);
    const landscape = probe.width >= probe.height;
    const longEdge = landscape ? probe.width : probe.height;
    const actions =
      longEdge > MAX_EDGE
        ? [{ resize: landscape ? { width: MAX_EDGE } : { height: MAX_EDGE } }]
        : [];
    const out = await ImageManipulator.manipulateAsync(uri, actions, {
      compress: 0.85,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    return out.uri;
  } catch {
    return uri;
  }
}
