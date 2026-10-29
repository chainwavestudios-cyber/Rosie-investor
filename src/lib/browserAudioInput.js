/**
 * Browser capture of an actual audioinput endpoint.
 * VB-Audio: CABLE Input is a playback/audiooutput sink; CABLE Output is the
 * recording/audioinput source supplied to this function.
 */
export function audioInputConstraints(deviceId) {
  return {
    audio: {
      // Never silently capture the system default if no specific input was selected.
      deviceId:{exact:deviceId},
      echoCancellation:false,
      noiseSuppression:false,
      autoGainControl:false,
    },
    video:false,
  };
}

export function describeAudioTrack(track, selectedLabel='') {
  const settings=track?.getSettings?.()||{};
  const count=Number(settings.channelCount);
  return {
    label:track?.label||selectedLabel||'Unknown input',
    channelCount:Number.isFinite(count)&&count>=1?count:null,
    sampleRate:Number(settings.sampleRate)||null,
    readyState:track?.readyState||'unknown',
    muted:!!track?.muted,
    sampleSize:Number(settings.sampleSize)||null,
  };
}

export function explainCaptureError(error) {
  const name=String(error?.name||'');
  const message=String(error?.message||'').slice(0,240);
  switch(name){
    case 'NotAllowedError':
    case 'SecurityError':
      return 'Chrome blocked access to the selected recording input. Click the microphone icon beside this site’s address, allow microphone access, and retry.';
    case 'NotFoundError':
    case 'OverconstrainedError':
      return 'Chrome could not open that exact recording endpoint. Click Refresh Inputs, select the cable recording/Output endpoint again, and retry.';
    case 'NotReadableError':
    case 'AbortError':
      return 'Chrome sees this cable but cannot read from it. Close another program holding the recording device exclusively, check the Windows Sound recording device, and retry.';
    case 'InvalidStateError':
      return 'This page is not active. Focus the tab, then retry the cable test.';
    default:
      return 'Could not open selected audio input'+(message?': '+message:'. Check cable routing and microphone permissions.');
  }
}
