const ApiError = require('../utils/ApiError');

// validate(schema, 'body' | 'query' | 'params')
module.exports = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(ApiError.unprocessable('Please check the highlighted fields', details));
  }
  // `req.query` is a getter in Express 5; assign defensively.
  if (source === 'query') Object.defineProperty(req, 'validatedQuery', { value: result.data, configurable: true });
  else req[source] = result.data;
  next();
};
