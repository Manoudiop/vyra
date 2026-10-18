import { IMAGE_UPLOAD } from '@vyra/shared';
import { ImageManipulator } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { pickPhoto, preparePhoto, toUploadForm } from './photo';

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));

const mockResize = jest.fn();
const mockSaveAsync = jest.fn();
jest.mock('expo-image-manipulator', () => ({
  SaveFormat: { JPEG: 'jpeg' },
  ImageManipulator: {
    manipulate: jest.fn(() => ({
      resize: mockResize,
      renderAsync: jest.fn(async () => ({ saveAsync: mockSaveAsync })),
    })),
  },
}));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const granted = { granted: true, canAskAgain: true } as ImagePicker.PermissionResponse;
const MAX = IMAGE_UPLOAD.clientMaxDimension;

beforeEach(() => jest.clearAllMocks());

describe('pickPhoto', () => {
  it('asks for the camera permission and opens the camera in portrait framing', async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue(granted);
    picker.launchCameraAsync.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file:///shot.heic', width: 3024, height: 4032 }],
    } as ImagePicker.ImagePickerResult);
    expect(await pickPhoto('camera')).toEqual({
      status: 'picked',
      photo: { uri: 'file:///shot.heic', width: 3024, height: 4032 },
    });
    expect(picker.launchCameraAsync).toHaveBeenCalledWith(
      expect.objectContaining({ aspect: [4, 5], exif: false, mediaTypes: ['images'] }),
    );
    expect(picker.requestMediaLibraryPermissionsAsync).not.toHaveBeenCalled();
  });

  it('reports a refusal and whether the app may ask again', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: false,
      canAskAgain: false,
    } as ImagePicker.PermissionResponse);
    expect(await pickPhoto('library')).toEqual({ status: 'denied', canAskAgain: false });
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('treats closing the picker as a cancel', async () => {
    picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
    picker.launchImageLibraryAsync.mockResolvedValue({
      canceled: true,
      assets: null,
    } as ImagePicker.ImagePickerResult);
    expect(await pickPhoto('library')).toEqual({ status: 'cancelled' });
  });
});

describe('preparePhoto', () => {
  beforeEach(() =>
    mockSaveAsync.mockResolvedValue({ uri: 'file:///ready.jpg', width: 1200, height: 1600 }),
  );

  it('downscales the longest side and re-encodes as JPEG (HEIC included)', async () => {
    const ready = await preparePhoto({ uri: 'file:///shot.heic', width: 3024, height: 4032 });
    expect(ImageManipulator.manipulate).toHaveBeenCalledWith('file:///shot.heic');
    expect(mockResize).toHaveBeenCalledWith({ height: MAX });
    expect(mockSaveAsync).toHaveBeenCalledWith({ format: 'jpeg', compress: 0.85 });
    expect(ready).toEqual({ uri: 'file:///ready.jpg', width: 1200, height: 1600 });

    await preparePhoto({ uri: 'file:///wide.jpg', width: 4000, height: 3000 });
    expect(mockResize).toHaveBeenLastCalledWith({ width: MAX });
  });

  it('keeps small photos at their size', async () => {
    await preparePhoto({ uri: 'file:///small.jpg', width: MAX - 1, height: MAX - 100 });
    expect(mockResize).not.toHaveBeenCalled();
    expect(mockSaveAsync).toHaveBeenCalled();
  });
});

describe('toUploadForm', () => {
  it('sends the photo as a JPEG file part', async () => {
    const append = jest.spyOn(FormData.prototype, 'append').mockImplementation(() => undefined);
    await toUploadForm({ uri: 'file:///ready.jpg', width: 1, height: 1 });
    expect(append).toHaveBeenCalledWith(
      'file',
      expect.objectContaining({ uri: 'file:///ready.jpg', name: 'photo.jpg', type: 'image/jpeg' }),
    );
    append.mockRestore();
  });
});
