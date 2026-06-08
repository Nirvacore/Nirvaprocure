/**
 * Shape of the JWT payload that the frontend sends as `Authorization: Bearer ...`.
 *
 * `sub`, `iat`, `exp` are standard JWT claims. The rest are NIRVAPROCURE-specific
 * and are populated by the backend when issuing a token (login endpoint, to come).
 */
export interface JwtPayload {
  sub:   string;   // user id (UUID)
  org:   string;   // org id (UUID)
  email: string;
  iat?:  number;
  exp?:  number;
}
