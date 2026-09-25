import type { Config } from '../../hoq-fe/src/game/types';

export type Request = { requestId: string } & (
  | { type: 'session.create'; payload: { playerId: string; name: string; config: Config } }
  | { type: 'session.join'; payload: { playerId: string; name: string; joinCode: string } }
  | { type: 'session.resume'; payload: { playerId: string; sessionId: string } }
  | { type: 'session.configure'; payload: { config: Config } }
  | { type: 'player.action'; payload: { action: 'hit' | 'quit' | 'choose'; round: number; turnId: number; choiceId?: string; optionId?: string } }
  | { type: 'round.start' | 'session.sync' | 'session.leave'; payload: Record<string, never> }
);
export class RequestError extends Error {
  constructor(public code: string, message: string) { super(message); }
}
export function fail(code: string, message: string): never { throw new RequestError(code, message); }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function parseRequest(value: unknown): Request {
  if (!object(value) || typeof value.requestId !== 'string' || !/^[\w-]{1,80}$/.test(value.requestId) || !object(value.payload)) fail('INVALID_MESSAGE', 'Expected type, requestId, and payload.');
  const p = value.payload;
  const identity = () => {
    if (typeof p.playerId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.playerId)) fail('INVALID_ID', 'Use a random UUID v4 player ID.');
    p.playerId = p.playerId.toLowerCase();
  };
  const name = () => { if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 40) fail('INVALID_NAME', 'Name must contain 1–40 characters.'); p.name = p.name.trim(); };
  switch (value.type) {
    case 'session.create':
      identity(); name();
      if (p.config === undefined) p.config = { target: 30, turnMs: 10000 };
      validateConfig(p.config);
      break;
    case 'session.configure': validateConfig(p.config); break;
    case 'session.join':
      identity(); name();
      if (typeof p.joinCode !== 'string') fail('INVALID_CODE', 'Provide a six-character join code.');
      p.joinCode = p.joinCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{6}$/.test(String(p.joinCode))) fail('INVALID_CODE', 'Provide a six-character join code.');
      break;
    case 'session.resume': identity(); if (typeof p.sessionId !== 'string' || p.sessionId.length > 80) fail('INVALID_ID', 'Provide a session ID.'); break;
    case 'player.action':
      if (!['hit', 'quit', 'choose'].includes(String(p.action)) || !Number.isSafeInteger(p.round) || !Number.isSafeInteger(p.turnId)) fail('INVALID_ACTION', 'Provide action, round, and turnId.');
      if (p.action === 'choose' && (typeof p.choiceId !== 'string' || !/^choice-\d{1,12}$/.test(p.choiceId) || typeof p.optionId !== 'string' || !/^option-\d{1,5}$/.test(p.optionId))) fail('INVALID_ACTION', 'Provide a valid choiceId and optionId.');
      break;
    case 'round.start': case 'session.sync': case 'session.leave': break;
    default: fail('INVALID_MESSAGE', 'Unknown message type.');
  }
  return value as Request;
}
function validateConfig(config: unknown) {
  if (!object(config) || !Number.isSafeInteger(config.target) || Number(config.target) < 1 || ![null, 10000, 30000].includes(config.turnMs as number | null)) fail('INVALID_CONFIG', 'Provide a positive target and turnMs of 10000, 30000, or null.');
}
