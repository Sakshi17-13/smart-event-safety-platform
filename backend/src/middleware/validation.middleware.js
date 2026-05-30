const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errors = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        logger.warn('Validation error', { errors, body: req.body });

        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          data: { errors },
        });
      }

      req.body = value;
      next();
    } catch (error) {
      logger.error('Validation middleware error:', error);
      next(new AppError('Validation error', 500));
    }
  };
};

const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errors = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        logger.warn('Query validation error', { errors, query: req.query });

        return res.status(400).json({
          success: false,
          message: 'Query validation failed',
          data: { errors },
        });
      }

      req.query = value;
      next();
    } catch (error) {
      logger.error('Query validation middleware error:', error);
      next(new AppError('Validation error', 500));
    }
  };
};

const validateParams = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        const errors = error.details.map((detail) => ({
          field: detail.path.join('.'),
          message: detail.message,
        }));

        logger.warn('Params validation error', { errors, params: req.params });

        return res.status(400).json({
          success: false,
          message: 'Params validation failed',
          data: { errors },
        });
      }

      req.params = value;
      next();
    } catch (error) {
      logger.error('Params validation middleware error:', error);
      next(new AppError('Validation error', 500));
    }
  };
};

module.exports = {
  validateRequest,
  validateQuery,
  validateParams,
};
