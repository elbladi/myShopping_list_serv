const jwt = require('jsonwebtoken');
const db = require('../database/config');
const HttpError = require('../util/http-error');


const login = async (req, res, next) => {

    const { id } = req.body;

    if (id.length < 2) return next(new HttpError("Please enter a correct value", 400));

    try {
        await db.firebase.firestore().collection('users')
            .where('p', '==', id)
            .get()
            .then(snapshot => {
                let user;
                snapshot.forEach(doc => {
                    user = doc.id
                })

                if (!user) return next(new HttpError("Please enter a correct value", 400));

                let token = jwt.sign(
                    {
                        userId: user
                    },
                    process.env.JWT_KEY,
                    { expiresIn: '1h' }
                )
                res.json({
                    userId: user,
                    token: token,
                });
            })
            .catch(err => {
                throw err;
            })
    } catch (error) {
        console.log(error)
        return next(new HttpError("Please enter a correct value", 400));
    }
};

exports.login = login;