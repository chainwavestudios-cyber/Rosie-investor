/** Capture only the browser input explicitly selected by the operator. */
export function audioInputConstraints(deviceId) {
  return {
    audio: {
      deviceId: { exact: deviceId },
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
    },
  };
}