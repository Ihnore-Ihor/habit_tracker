import { jwtDecode } from 'jwt-decode';

const ROLE_CLAIMS = [
  'role',
  'roles',
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
];

const NAME_CLAIMS = [
  'name',
  'unique_name',
  'preferred_username',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name',
];

const ID_CLAIMS = [
  'sub',
  'nameid',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier',
];

const EMAIL_CLAIMS = [
  'email',
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress',
];

function pickClaim(payload, keys) {
  for (const k of keys) {
    if (payload[k] !== undefined && payload[k] !== null) return payload[k];
  }
  return undefined;
}

export function decodeToken(token) {
  if (!token) return null;
  try {
    const payload = jwtDecode(token);
    const rawRole = pickClaim(payload, ROLE_CLAIMS);
    const role = Array.isArray(rawRole) ? rawRole[0] : rawRole;
    return {
      id: pickClaim(payload, ID_CLAIMS),
      name: pickClaim(payload, NAME_CLAIMS),
      email: pickClaim(payload, EMAIL_CLAIMS),
      role: role ?? 'User',
      exp: payload.exp,
      raw: payload,
    };
  } catch {
    return null;
  }
}

export function isExpired(token) {
  const d = decodeToken(token);
  if (!d?.exp) return true;
  return Date.now() >= d.exp * 1000;
}
