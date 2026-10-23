/**
 * livekitToken.ts — mints the short-lived LiveKit room passes the video widget needs:
 * one for the visitor's browser (the page connects with it) and one for the Protoface
 * avatar worker (so the avatar joins the same room). The API secret never leaves the
 * server — the browser only ever receives these expiring tokens.
 */
import { secrets } from 'base44:runtime';

const TOKEN_TTL_SECONDS = 60 * 60;
/** The identity the Protoface avatar worker joins with — the same one its SDK expects. */
export const AVATAR_IDENTITY = 'protoface-avatar-agent';

const encoder = new TextEncoder();

function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** LiveKit room passes are plain HS256 JWTs signed with the project's API secret. */
async function signRoomToken(apiKey: string, apiSecret: string, identity: string, roomName: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = base64Url(
    encoder.encode(
      JSON.stringify({
        iss: apiKey,
        sub: identity,
        nbf: now - 5,
        iat: now,
        exp: now + TOKEN_TTL_SECONDS,
        video: {
          room: roomName,
          roomJoin: true,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        },
      }),
    ),
  );
  const body = `${header}.${payload}`;
  const key = await crypto.subtle.importKey('raw', encoder.encode(apiSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  return `${body}.${base64Url(new Uint8Array(signature))}`;
}

export interface RoomPass {
  livekitUrl: string;
  roomName: string;
  participantToken: string;
  workerToken: string;
  workerIdentity: string;
}

export function livekitConfigured(): boolean {
  return Boolean(
    String(secrets.get('LIVEKIT_URL') || '').trim() &&
      String(secrets.get('LIVEKIT_API_KEY') || '').trim() &&
      String(secrets.get('LIVEKIT_API_SECRET') || '').trim(),
  );
}

export async function mintRoomPass(roomName: string, visitorIdentity: string): Promise<RoomPass> {
  const livekitUrl = String(secrets.get('LIVEKIT_URL') || '').trim();
  const apiKey = String(secrets.get('LIVEKIT_API_KEY') || '').trim();
  const apiSecret = String(secrets.get('LIVEKIT_API_SECRET') || '').trim();
  if (!livekitUrl || !apiKey || !apiSecret) throw new Error('The video room is not configured yet.');

  const [participantToken, workerToken] = await Promise.all([
    signRoomToken(apiKey, apiSecret, visitorIdentity, roomName),
    signRoomToken(apiKey, apiSecret, AVATAR_IDENTITY, roomName),
  ]);

  return { livekitUrl, roomName, participantToken, workerToken, workerIdentity: AVATAR_IDENTITY };
}