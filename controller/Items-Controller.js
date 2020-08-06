const HttpError = require('../util/http-error');
const db = require('../database/config');
const io = require('../socket');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');

const transporter = nodemailer.createTransport(sendgridTransport({
    auth: {
        api_key: process.env.MAILER_ID
    }
}));
const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const sendMail = (req, res, next) => {

    let today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(months[today.getMonth()]);
    const yyyy = today.getFullYear();

    today = dd + '/' + mm + '/' + yyyy;

    try {
        let listOfItems = [...req.body.items];

        let html = `<h1>Your shop list of ${today} is here:</h1><br><ul style="font-size: 1.5rem;">`
        listOfItems.forEach(item => {
            let itemName = item.replace('_', ' ');
            itemName = itemName.charAt(0).toUpperCase() + itemName.slice(1);
            html += '<li style="margin: 10px 0;">' + itemName + '</li>'
        })
        html += '</ul>';

        db.firebase.database().ref(`car/`).remove()
            .then(resp => {
                transporter.sendMail({
                    to: ['yourMail@gmail.com'],
                    from: 'verifiedMail@hotmail.com',
                    subject: `${today} Shop list! `,
                    html: html
                })
                    .then(resp => {
                        res.json({
                            mail: 'MAIL SENDED'
                        });
                    })
                    .catch(err => {
                        return next(new HttpError(err, 404))
                    })
            })
            .catch(err => next(new HttpError(err, 404)))

    } catch (error) {
        return next(new HttpError(error, 404))
    }
}

const addToCar = async (req, res, next) => {
    const name = req.params.name;
    try {

        let orderedList = await db.firebase.database().ref().child('/orderedList')
            .once("value")
            .then(snap => snap.val())
            .catch(err => next(new HttpError(err.message, 503)))

        const itemToAdd = {
            "checked": false,
            "name": name
        }

        if (orderedList) {
            orderedList.push(itemToAdd)

            await db.firebase.database().ref(`/orderedList`).set(orderedList)
                .then(_ => {
                    res.json({ message: `${name} ADDED TO CAR` })
                })
                .catch(err => next(new HttpError(err, 500)))

        } else {
            await db.firebase.database().ref(`/orderedList`).set([itemToAdd])
                .then(_ => {
                    res.json({ message: `${name} ADDED TO CAR` })
                })
                .catch(err => next(new HttpError(err, 500)))
        }


    } catch (error) {
        return next(new HttpError(error.message, 503));
    }
}

const removeToCar = async (req, res, next) => {
    const name = req.params.name;
    try {

        let orderedList = await db.firebase.database().ref().child('/orderedList')
            .once("value")
            .then(snap => snap.val())
            .catch(err => next(new HttpError(err.message, 503)))

        if (!orderedList) return next(new HttpError(error.message, 503));

        let index = orderedList.findIndex(item => item.name === name);
        if (index < 0) res.json({ message: 'Nothing to delete' });

        orderedList.splice(index, 1);

        await db.firebase.database().ref().child('/orderedList')
            .set(orderedList)
            .then(_ => {
                res.json({ message: `${name} REMOVED TO CAR` })
            })
            .catch(err => next(new HttpError(err, 500)))
    } catch (error) {
        return next(new HttpError(error.message, 503));
    }
}

const getItems = async (req, res, next) => {
    let response;

    try {
        await db.firebase.database().ref().child('/items')
            .once("value")
            .then(snap => response = snap.val());

    } catch (error) {
        return next(new HttpError(error.message, 500));
    }

    if (!response) {
        return next(new HttpError('Invalid. Please, try again', 404));
    };
    res.json({
        items: response
    });

}

const addItem = async (req, res, next) => {
    const { itemName } = req.body;
    let response;
    let current;
    try {
        await db.firebase.database().ref().child(`/items/${itemName}`)
            .once("value").then(snap => current = snap.val());

        await db.firebase.database().ref().update({ [`/items/${itemName}`]: current + 1 }).then(response = true);
    } catch (error) {
        return next(new HttpError(error.message, 503));
    }

    if (!response) {
        return next(new HttpError('Not Updated. Please, try again', 503));
    }

    io.getIO().emit('added', { item: itemName });
    res.json({
        message: `${itemName} UPDATED`
    })

};

const deleteItem = async (req, res, next) => {
    const { itemName } = req.body;
    let response;
    let current;
    try {
        await db.firebase.database().ref().child(`/items/${itemName}`)
            .once("value").then(snap => current = snap.val());

        if (current < 1) {
            return next(new HttpError("NOT ALLOWED", 406));
        }

        await db.firebase.database().ref().update({ [`/items/${itemName}`]: current - 1 }).then(response = true);
    } catch (error) {
        return next(new HttpError(error.message, 503));
    }

    if (!response) {
        return next(new HttpError('Not Updated. Please, try again', 503));
    }

    io.getIO().emit('deleted', { item: itemName });
    res.json({
        message: `${itemName} UPDATED`
    })
}

const getCar = (req, res, next) => {
    try {
        db.firebase.database().ref().child('/orderedList')
            .once("value")
            .then(snap => {
                if (snap) {
                    response = [...snap.val()]
                    res.json({
                        car: response
                    })
                } else {
                    res.json({
                        car: []
                    })
                }
            })
            .catch(err => next(new HttpError(err.message, 503)))

    } catch (error) {

    }
}

const goShop = (req, res, next) => {
    /**
     * upload the list array
     */

}

const setOrder = async (req, res, next) => {
    /**
     * upload the list array
     */
    try {
        db.firebase.database().ref('/orderedList').set(req.body)
            .then(_ => {
                res.status(200).send('Ok');
            })
            .catch(err => next(new HttpError(err.message, 503)))

    } catch (error) {
        return next(new HttpError(err.message, 503))
    }
}

const getListToShop = async (req, res, next) => {
    try {
        await db.firebase.database().ref().child('/orderedList')
            .once('value').then(snap => {
                if (!snap.val()) {
                    res.json({
                        items: []
                    })
                } else {
                    res.json({
                        items: [...snap.val()]
                    })
                }
            }).catch(err => {
                console.log('ERROR!!')
                res.json({
                    message: 'Algo salio mal!'
                })
            })
    } catch (error) {
        console.log(error.message);
        return next(new HttpError(error.message), 500);
    }
}

const updateOrderedList = async (req, res, next) => {
    try {
        await db.firebase.database().ref().child('/orderedList')
            .set(req.body)
            .then(_ => {
                res.json({
                    message: 'Updated'
                })
            })
            .catch(err => {
                console.log(err);
                res.json({
                    message: 'Algo salio mal!'
                })
            })
    } catch (error) {
        console.log(error.message);
        return next(new HttpError(error.message), 500);
    }
}

exports.getItems = getItems;
exports.addItem = addItem;
exports.deleteItem = deleteItem;
exports.sendMail = sendMail;
exports.addToCar = addToCar;
exports.removeToCar = removeToCar;
exports.getCar = getCar;
exports.goShop = goShop;
exports.setOrder = setOrder;
exports.getListToShop = getListToShop;
exports.updateOrderedList = updateOrderedList;