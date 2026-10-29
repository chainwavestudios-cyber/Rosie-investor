/**
 * Live Call audio profiles: explicit saves only; never guess a missing device.
 * Browser audiooutput choices are stored as a preference. They do not change
 * the operating system's playback route by themselves.
 */
export const AUDIO_MODE_DEFAULTS = [
  { name: 'Computer Setup', saved: false },
  { name: 'Cell Setup', saved: false },
  { name: 'Twilio Stream', saved: true, transport: 'twilio' },
];

export function audioModes(setups) {
  return AUDIO_MODE_DEFAULTS.map((base, i) => ({
    ...base,
    ...(Array.isArray(setups) && setups[i] && typeof setups[i] === 'object' ? setups[i] : {}),
    name: (Array.isArray(setups) && typeof setups[i]?.name === 'string' ? setups[i].name : base.name) || base.name,
  }));
}

/** Strong match by device id, or by a UNIQUE nonempty label after reconnection. */
export function findAudioDevice(devices = [], savedId = '', savedLabel = '') {
  const items = Array.isArray(devices) ? devices : [];
  if (savedId) {
    const byId = items.find(d => d.deviceId === savedId);
    // A previously named device cannot be verified from an unlabeled entry.
    // Ask for a permission-granting re-scan rather than guessing.
    if (byId && (!savedLabel || byId.label === savedLabel)) return byId;
  }
  if (savedLabel) {
    const byLabel = items.filter(d => d.label && d.label === savedLabel);
    if (byLabel.length === 1) return byLabel[0];
  }
  return null;
}

export function resolveAudioMode(preset, inputs = [], outputs = []) {
  if (preset?.transport === 'twilio') return { valid: true, problems: [], micId: '', customerId: '', outputId: '', agentGain: 1, customerGain: 1 };
  if (!preset?.saved) return { valid: false, problems: ['Choose and save the devices for this mode first.'], micId: '', customerId: '', outputId: '' };
  const problems = [];
  const agent = findAudioDevice(inputs, preset.micDeviceId, preset.micLabel);
  if (!agent) problems.push('Saved agent microphone is disconnected or cannot be identified. Re-scan and select it.');
  const needsCustomer = !!(preset.customerDeviceId || preset.customerLabel);
  const customer = needsCustomer ? findAudioDevice(inputs, preset.customerDeviceId, preset.customerLabel) : null;
  if (needsCustomer && !customer) problems.push('Saved customer input is disconnected or cannot be identified.');
  if (agent && customer && agent.deviceId === customer.deviceId) problems.push('Choose separate agent and customer inputs.');
  const needsOutput = !!(preset.outputDeviceId || preset.outputLabel);
  const output = needsOutput ? findAudioDevice(outputs, preset.outputDeviceId, preset.outputLabel) : null;
  if (needsOutput && !output) problems.push('Saved preferred output is unavailable.');
  return {
    valid: problems.length === 0,
    problems,
    micId: agent?.deviceId || '',
    customerId: customer?.deviceId || '',
    outputId: output?.deviceId || '',
    agentGain: Number.isFinite(Number(preset.agentGain)) ? Number(preset.agentGain) : 1,
    customerGain: Number.isFinite(Number(preset.customerGain)) ? Number(preset.customerGain) : 1,
  };
}

export function captureAudioMode(preset, selection, inputs = [], outputs = []) {
  const problems = [];
  const agent = inputs.find(d => d.deviceId === selection.micDeviceId);
  if (!agent) problems.push('Select a connected agent microphone before saving.');
  const customer = selection.customerMicId ? inputs.find(d => d.deviceId === selection.customerMicId) : null;
  if (selection.customerMicId && !customer) problems.push('The customer input is not connected.');
  if (agent && customer && agent.deviceId === customer.deviceId) problems.push('Choose separate agent and customer inputs.');
  const output = selection.outputDeviceId ? outputs.find(d => d.deviceId === selection.outputDeviceId) : null;
  if (selection.outputDeviceId && !output) problems.push('The selected preferred output is not connected.');
  const agentGain = Number(selection.agentGain), customerGain = Number(selection.customerGain);
  if (!Number.isFinite(agentGain) || agentGain < 0 || agentGain > 3 || !Number.isFinite(customerGain) || customerGain < 0 || customerGain > 3) problems.push('Gain must be between 0% and 300%.');
  return {
    valid: problems.length === 0, problems,
    mode: problems.length ? null : {
      ...preset, saved: true, version: 2,
      micDeviceId: agent.deviceId, micLabel: agent.label || '',
      customerDeviceId: customer?.deviceId || '', customerLabel: customer?.label || '',
      outputDeviceId: output?.deviceId || '', outputLabel: output?.label || '',
      agentGain, customerGain,
      savedAt: new Date().toISOString(),
    },
  };
}

/** Compare by stable label when available; avoid false 'edited' after replugging. */
function sameSelectedDevice(devices, id, savedId, savedLabel) {
  if (!id && !savedId && !savedLabel) return true;
  const selected = devices.find(d => d.deviceId === id);
  if (selected?.label && savedLabel) return selected.label === savedLabel;
  return id === (savedId || '');
}

export function isAudioModeEdited(mode, selected, inputs = [], outputs = []) {
  if (mode?.transport === 'twilio') return false;
  if (!mode?.saved) return true;
  if (!sameSelectedDevice(inputs, selected.micDeviceId, mode.micDeviceId, mode.micLabel)) return true;
  if (!sameSelectedDevice(inputs, selected.customerMicId, mode.customerDeviceId, mode.customerLabel)) return true;
  if (mode.version >= 2) {
    if (!sameSelectedDevice(outputs, selected.outputDeviceId, mode.outputDeviceId, mode.outputLabel)) return true;
    if (Number(selected.agentGain) !== Number(mode.agentGain) || Number(selected.customerGain) !== Number(mode.customerGain)) return true;
  }
  return mode.version !== 2; // older profiles require explicit complete save
}