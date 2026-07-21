import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'cardtkb-super-secret-key-3d-space';

export interface DecodedToken {
  userId: string;
  email: string;
}

export function verifyAuthToken(req: Request): DecodedToken | null {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as DecodedToken;
    return decoded;
  } catch (error) {
    console.error('Lỗi xác thực Token:', error);
    return null;
  }
}
