
const sendNotAuthorizedError = (res, message) =>
  res.status(401).json({
    error: message,
  });

const verifyAuthorizationForTokens = (allowedTokens) => async (
  req,
  res,
  next,
) => {
  if (!req.headers.authorization) {
    return sendNotAuthorizedError(res, 'Authorization header is missing');
  }

  const [tokenType, token] = req.headers.authorization.split(' ');

  if (!tokenType || !token) {
    return sendNotAuthorizedError(res, 'Missing token type or token');
  }

  if (tokenType.toLowerCase() === 'bearer' && allowedTokens.has(token)) {
    return next();
  }
};

module.exports = { verifyAuthorizationForTokens };