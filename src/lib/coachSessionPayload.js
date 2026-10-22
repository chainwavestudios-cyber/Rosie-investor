// Forward the already-authenticated coach session; never create a new session here.
export default function coachSessionPayload() {
  const stored = localStorage.getItem('debtCoachSession');
  if (!stored) return {};
  try {
    const session = JSON.parse(stored);
    return { sessionUserId: session.userId, sessionToken: session.token };
  } catch { return {}; }
}