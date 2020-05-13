const HttpError = require('../util/http-error');
const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
    if (req.method === 'OPTIONS') {
        return next();
    };

    let token;
    try {
        token = req.headers.authorization.split(' ')[1];
        if (!token) {
            throw new Error('auth fail');
        };
        const decodedToken = jwt.verify(token, process.env.JWT_KEY);
        req.userData = { userId: decodedToken.userId }
        next();
    } catch (error) {
        return next(new HttpError('Authentication failed', 401));
    };



};