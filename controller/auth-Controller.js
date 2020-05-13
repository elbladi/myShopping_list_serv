const jwt = require('jsonwebtoken');
const db = require('../database/config');
const HttpError = require('../util/http-error');


const login = (req, res, next) => {

    const { id } = req.body;

    if (id.length < 2) return next(new HttpError("Please enter a correct value", 400));

    try {
        db.firebase.database().ref().child(`/users/${id}`)
            .once("value")
            .then(snap => {
                let response = snap.val();
                if (response === null) {
                    return next(new HttpError('Not Authorized', 401));
                }
                let token = jwt.sign(
                    {
                        userId: response
                    },
                    process.env.JWT_KEY,
                    { expiresIn: '1h' }
                )
                res.json({
                    userId: response,
                    token: token,
                });
            })
            .catch(error => next(new HttpError(error.message, 500)))

    } catch (error) {
        return next(new HttpError(error.message, 500));
    }
};

exports.login = login;