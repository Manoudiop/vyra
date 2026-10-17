import { IMAGE_UPLOAD } from '@vyra/shared';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type PhotoSource = 'camera' | 'library';

export interface PickedPhoto {
  uri: string;
  width: number;
  height: number;
}

export type PickResult =
  | { status: 'picked'; photo: PickedPhoto }
  | { status: 'cancelled' }
  | { status: 'denied'; canAskAgain: boolean };

/** Asks for the right permission, then opens the camera or the photo library. */
export async function pickPhoto(source: PhotoSource): Promise<PickResult> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return { status: 'denied', canAskAgain: permission.canAskAgain };

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    // Portrait framing matches the closet cards (4:5).
    aspect: [4, 5],
    quality: 1,
    exif: false,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return { status: 'cancelled' };
  return { status: 'picked', photo: { uri: asset.uri, width: asset.width, height: asset.height } };
}

/**
 * Downscales and re-encodes as JPEG before upload: saves mobile data on slow
 * networks and turns iPhone HEIC into a format every server can read. The API
 * still validates and re-encodes everything.
 */
export async function preparePhoto(photo: PickedPhoto): Promise<PickedPhoto> {
  const context = ImageManipulator.manipulate(photo.uri);
  const longest = Math.max(photo.width, photo.height);
  if (longest > IMAGE_UPLOAD.clientMaxDimension) {
    context.resize(
      photo.width >= photo.height
        ? { width: IMAGE_UPLOAD.clientMaxDimension }
        : { height: IMAGE_UPLOAD.clientMaxDimension },
    );
  }
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: 0.85 });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

/** Multipart body for POST /api/storage/images. */
export async function toUploadForm(photo: PickedPhoto): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    // On web the URI is a blob:/data: URL; the browser needs a real Blob.
    const blob = await (await fetch(photo.uri)).blob();
    form.append('file', blob, 'photo.jpg');
  } else {
    // React Native's FormData accepts a file descriptor object.
    form.append('file', {
      uri: photo.uri,
      name: 'photo.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
  }
  return form;
}
