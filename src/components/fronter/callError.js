export default function callError(error) {
  const data = error?.response?.data;
  const message = data?.message || data?.error || error?.message || 'Call failed';
  return data?.twilioCode ? `Twilio ${data.twilioCode}: ${message}` : message;
}