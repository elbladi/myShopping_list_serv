const HttpError = require('../util/http-error');
const db = require('../database/config');
const fs = require('fs');
const io = require('../socket');
const nodemailer = require('nodemailer');
const sendgridTransport = require('nodemailer-sendgrid-transport');
const removd = require('removd');
const Blob = require('node-fetch');
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

    let items;
    try {
        await db.firebase.firestore().collection('items').get()
            .then(snapshot => {
                snapshot.forEach(doc => {
                    items = {
                        ...items,
                        [doc.id]: doc.data()
                    }
                });
            })
    } catch (error) {
        return next(new HttpError(error.message, 500));
    }

    res.json(items);

}

const addItem = async (req, res, next) => {
    const { itemId } = req.body;
    let current;
    let ref = db.firebase.firestore().collection('items').doc(itemId);

    try {
        await ref.get().then(doc => {
            if (!doc.exists) return next(new HttpError(error.message, 503));
            current = { ...doc.data() };
        })
    } catch (error) {
        return next(new HttpError(error.message, 503));
    }

    if (!current) {
        return next(new HttpError('Not Updated. Please, try again', 503));
    }

    try {
        await ref.update({
            count: current.count + 1
        }).catch(err => next(new HttpError('Not Updated. Please, try again', 503)))
    } catch (error) {
        return next(new HttpError('Not Updated. Please, try again', 503));
    }

    io.getIO().emit('added', { itemId });
    res.json({
        message: `${current.name} UPDATED`
    })

};

const deleteItem = async (req, res, next) => {
    const { itemId } = req.body;
    let current;
    let ref = db.firebase.firestore().collection('items').doc(itemId);

    try {
        await ref.get().then(doc => {
            if (!doc.exists) return next(new HttpError(error.message, 503));
            current = { ...doc.data() };
        })
    } catch (error) {
        return next(new HttpError(error.message, 503));
    }

    if (!current) {
        return next(new HttpError('Not Updated. Please, try again', 503));
    }

    try {
        await ref.update({
            count: current.count - 1
        }).catch(err => next(new HttpError('Not Updated. Please, try again', 503)))
    } catch (error) {
        return next(new HttpError('Not Updated. Please, try again', 503));
    }

    io.getIO().emit('deleted', { itemId });
    res.json({
        message: `${current.name} UPDATED`
    })
}

const getCar = async (req, res, next) => {

    const docId = req.params.carId;
    if (docId === '0') {
        try {
            let itemsInList;
            let carId;
            await db.firebase.firestore().collection('orderedList').get()
                .then(snapshot => {
                    snapshot.forEach(doc => {
                        itemsInList = doc.data().car;
                        carId = doc.id
                    })
                    res.status(200).json({ car: [...itemsInList], carId });
                })
                .catch(err => {
                    res.status(200).json({ car: [], carId: 0 });
                })
        } catch (error) {
        }
    } else {
        try {
            await db.firebase.firestore().collection('orderedList').doc(docId).get()
                .then(doc => {
                    if (doc.exists) {
                        res.status(200).json({ car: [...doc.data().car], carId: doc.id });
                    } else {
                        res.status(200).json({ car: [], carId: 0 });
                    }
                }).catch(err => {
                    res.status(200).json({ car: [], carId: 0 });
                })
        } catch (err) {
        }
    }

}

const goShop = (req, res, next) => {
}

const setOrder = async (req, res, next) => {
    /**
     * upload the list array
     */
    const { carId, newArray } = req.body;
    console.log(carId);
    console.log(newArray);

    try {
        await db.firebase.firestore().collection('orderedList').doc(carId)
            .update({
                car: newArray
            })
            .then(() => {
                res.status(200).send('Ok');
            })
            .catch(err => next(new HttpError(err.message, 503)))
    } catch (error) {
        return next(new HttpError(error.message, 503))
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


const uploadItem = async (req, res, next) => {

    const { name, user } = req.body;
    const filePath = req.file.path;

    try {
        if (user === 'bladi') fs.createReadStream(filePath).pipe(fs.createWriteStream(`images/beli/${name}.png`));
        else fs.createReadStream(filePath).pipe(fs.createWriteStream(`images/bladi/${name}.png`));

    } catch (error) {
        return next(new HttpError(error.message), 500);
    }

    try {
        await db.firebase.firestore().collection('items').add({
            name: name,
            count: 0
        }).then(_ => {
            res.status(201).json();
        }).catch(err => next(new HttpError(err.message), 500))
    } catch (error) {
        return next(new HttpError(error.message), 500);
    }
}


const removeBackground = async (req, res, next) => {

    const filePath = req.file.path;

    try {
        const done = await removd.file({
            deleteOriginal: true,
            detect: 'product',
            format: 'png',
            destination: filePath,
            source: filePath,
            apikey: process.env.REMOVE_BG_KEY
        })


        if (done.error) {
            const path = filePath.split('/');
            res.json({
                image: `/${path[1]}/${path[2]}`
            });
        } else {
            const parts = done.destination.split('/');
            res.json({
                image: `/tempImg/${parts[parts.length - 1]}`
            });
        }

    } catch (error) {
        console.log('error:')
        console.log(error)
        return next(new HttpError(error.message), 500);
    }

}

const deleteContent = async (req, res, next) => {
    const { itemId, name } = req.body;

    let deleted;
    try {
        await db.firebase.firestore().collection('items').doc(itemId).delete()
            .then(_ => deleted = true)
            .catch(_ => deleted = false);
    } catch (error) {
        deleted = false
    }

    if (!deleted) return next(new HttpError(error.message), 500);

    try {
        if (fs.existsSync(`./images/bladi/${name}.png`)) fs.unlink(`images/bladi/${name}.png`, _ => { })
        if (fs.existsSync(`./images/beli/${name}.png`)) fs.unlink(`images/beli/${name}.png`, _ => { })

    } catch (_) { }

    res.status(200).json({});

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
exports.uploadItem = uploadItem;
exports.removeBackground = removeBackground;
exports.deleteContent = deleteContent;