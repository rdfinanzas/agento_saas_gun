import jwt from 'jsonwebtoken';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  role: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenPayload {
  userId: string;
  type: 'refresh';
  iat?: number;
  exp?: number;
}

export class JwtService {
  private secret: string;
  private expiresIn: string;
  private refreshExpiresIn: string;

  constructor() {
    this.secret = process.env.JWT_SECRET || 'default-secret-change-in-production';
    this.expiresIn = process.env.JWT_EXPIRES_IN || '7d';
    this.refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  }

  generateToken(userId: string, tenantId: string, role: string): string {
    const payload: JwtPayload = { userId, tenantId, role };
    return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn as jwt.SignOptions['expiresIn'] });
  }

  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, this.secret) as JwtPayload;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) throw new Error('Token expirado');
      if (error instanceof jwt.JsonWebTokenError) throw new Error('Token invalido');
      throw new Error('Error al verificar token');
    }
  }

  generateRefreshToken(userId: string): string {
    const payload: RefreshTokenPayload = { userId, type: 'refresh' };
    return jwt.sign(payload, this.secret, { expiresIn: this.refreshExpiresIn as jwt.SignOptions['expiresIn'] });
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret) as RefreshTokenPayload;
      if (decoded.type !== 'refresh') throw new Error('Token no es de tipo refresh');
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) throw new Error('Refresh token expirado');
      throw new Error('Refresh token invalido');
    }
  }
}

export const jwtService = new JwtService();
