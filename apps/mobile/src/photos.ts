// Photos she loves, for the free journey (same rules as the website's step 1): up to three,
// read for colours on this phone. The photo never leaves the phone (owner, 13 Nov 2026):
// only the colours are sent. Nothing is stored by us. Standard Expo modules only (no paid service).
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { decode } from 'jpeg-js';
import { base64Bytes, strongestColours } from './photoColours';
export { base64Bytes, strongestColours };

export const MAX_PHOTOS = 3;

export interface JourneyPhoto { id: string; uri: string; width: number; height: number; colours: string[]; loves: string[] }

/** Opens her photo library (never the camera) and reads the chosen photo's colours here. */
export async function pickPhoto(): Promise<JourneyPhoto | null> {
  const got = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, allowsMultipleSelection: false });
  if (got.canceled || !got.assets?.length) return null;
  const a = got.assets[0];
  const small = await manipulateAsync(a.uri, [{ resize: { width: 48, height: 48 } }], { base64: true, format: SaveFormat.JPEG, compress: 0.9 });
  const colours = small.base64 ? strongestColours(decode(base64Bytes(small.base64), { useTArray: true }).data) : [];
  return { id: `${Date.now()}`, uri: a.uri, width: a.width, height: a.height, colours, loves: [] };
}
