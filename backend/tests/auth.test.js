const { generateToken, verifyToken, JWT_SECRET } = require('./authUtils');

describe('JWT Authentication', () => {
  const testUser = { id: '123e4567-e89b-12d3-a456-426614174000', username: 'testuser' };

  test('should generate a valid token', () => {
    const token = generateToken(testUser);
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.split('.')).toHaveLength(3);
  });

  test('should verify valid token', () => {
    const token = generateToken(testUser);
    const decoded = verifyToken(token);
    expect(decoded.id).toBe(testUser.id);
    expect(decoded.username).toBe(testUser.username);
  });

  test('should throw error for invalid token', () => {
    expect(() => verifyToken('invalid-token')).toThrow();
  });

  test('should throw error for tampered token', () => {
    const token = generateToken(testUser);
    const tamperedToken = token.slice(0, -5) + 'xxxxx';
    expect(() => verifyToken(tamperedToken)).toThrow();
  });
});